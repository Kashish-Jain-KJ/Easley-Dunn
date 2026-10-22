/**
 * @file teams.service.js
 * @description Business rules for teams and team members (DESIGN.md §3, §10.1).
 *
 * Every write follows the same shape:
 *   1. checks, in order, each failing with its own specific error;
 *   2. the change and its audit entry in one transaction, so no change can exist
 *      without its log.
 * A refused attempt (404/409) is audited as FAILED with the reason.
 * Malformed input (400) is not audited.
 */

"use strict";

const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { withTransaction } = require("../db/transaction");
const teamsRepo = require("../repositories/teams.repo");
const teamMembersRepo = require("../repositories/teamMembers.repo");
const usersRepo = require("../repositories/users.repo");
const auditRepo = require("../repositories/auditEvents.repo");

const NAME_MAX = 100;
const DESCRIPTION_MAX = 1000;
const PG_UNIQUE_VIOLATION = "23505";

function displayName(user) {
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
}

/**
 * Audits a refused attempt, then throws the refusal. If the audit write itself
 * fails, that is logged and the original refusal is still thrown.
 */
async function refuse(err, { actorUserId, action, targetUserId = null, teamId = null, detail = {} }) {
  try {
    await auditRepo.record({
      actorUserId,
      action,
      outcome: "FAILED",
      targetUserId,
      teamId,
      detail: { ...detail, reason: err.message, status: err.statusCode },
    });
  } catch (auditErr) {
    logger.error(`[teams] Could not audit refused ${action}: ${auditErr.message}`);
  }
  throw err;
}

function cleanName(name) {
  if (typeof name !== "string" || name.trim() === "") {
    throw ApiError.badRequest("Team name is required.");
  }
  const trimmed = name.trim();
  if (trimmed.length > NAME_MAX) {
    throw ApiError.badRequest(`Team name must be at most ${NAME_MAX} characters.`);
  }
  return trimmed;
}

function cleanDescription(description) {
  if (description === undefined || description === null) return null;
  if (typeof description !== "string") {
    throw ApiError.badRequest("Description must be text.");
  }
  const trimmed = description.trim();
  if (trimmed.length > DESCRIPTION_MAX) {
    throw ApiError.badRequest(`Description must be at most ${DESCRIPTION_MAX} characters.`);
  }
  return trimmed || null;
}

// Loads a team for a write, refusing (and auditing) if it's missing or archived.
async function loadActiveTeam(teamId, audit) {
  const team = await teamsRepo.findById(teamId);
  if (!team) {
    // teamId goes in detail: the audit row's team_id must reference a real team.
    return refuse(ApiError.notFound(`Team ${teamId} not found.`), { ...audit, detail: { teamId } });
  }
  if (!team.is_active) {
    return refuse(ApiError.conflict(`Team '${team.name}' is archived and can't be changed.`), { ...audit, teamId });
  }
  return team;
}

// ── Reads ────────────────────────────────────────────────────────────────────

async function listTeams() {
  return teamsRepo.listWithSummary();
}

async function getTeam(teamId) {
  const team = await teamsRepo.findById(teamId);
  if (!team) throw ApiError.notFound(`Team ${teamId} not found.`);
  const members = await teamMembersRepo.listByTeam(teamId);
  return { ...team, members };
}

// ── Teams ────────────────────────────────────────────────────────────────────

async function createTeam({ name, description }, actorUserId) {
  const cleanedName = cleanName(name);
  const cleanedDescription = cleanDescription(description);
  const audit = { actorUserId, action: "TEAM_CREATED", detail: { name: cleanedName } };

  if (await teamsRepo.findActiveByName(cleanedName)) {
    return refuse(ApiError.conflict(`An active team named '${cleanedName}' already exists.`), audit);
  }

  try {
    return await withTransaction(async (db) => {
      const team = await teamsRepo.create({ name: cleanedName, description: cleanedDescription, createdBy: actorUserId }, db);
      await auditRepo.record({ ...audit, teamId: team.team_id }, db);
      return team;
    });
  } catch (err) {
    // Two requests creating the same name at once: the unique index catches the second.
    if (err.code === PG_UNIQUE_VIOLATION) {
      return refuse(ApiError.conflict(`An active team named '${cleanedName}' already exists.`), audit);
    }
    throw err;
  }
}

async function updateTeam(teamId, { name, description }, actorUserId) {
  const audit = { actorUserId, action: "TEAM_UPDATED" };
  if (name === undefined && description === undefined) {
    throw ApiError.badRequest("Nothing to update: send name and/or description.");
  }
  const newName = name === undefined ? undefined : cleanName(name);
  const newDescription = description === undefined ? undefined : cleanDescription(description);

  const team = await loadActiveTeam(teamId, audit);
  const after = {
    name: newName === undefined ? team.name : newName,
    description: newDescription === undefined ? team.description : newDescription,
  };

  if (newName !== undefined && newName.toLowerCase() !== team.name.toLowerCase()) {
    const clash = await teamsRepo.findActiveByName(newName);
    if (clash) {
      return refuse(ApiError.conflict(`An active team named '${newName}' already exists.`), { ...audit, teamId });
    }
  }

  try {
    return await withTransaction(async (db) => {
      const updated = await teamsRepo.update(teamId, after, db);
      await auditRepo.record({
        ...audit,
        teamId,
        detail: { before: { name: team.name, description: team.description }, after },
      }, db);
      return updated;
    });
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      return refuse(ApiError.conflict(`An active team named '${after.name}' already exists.`), { ...audit, teamId });
    }
    throw err;
  }
}

/**
 * Archives a team and removes its members (each removal audited).
 * When teams can hand out access (team pools), this must first refuse while any
 * member still holds access granted through this team.
 */
async function archiveTeam(teamId, actorUserId) {
  const audit = { actorUserId, action: "TEAM_ARCHIVED" };
  const team = await teamsRepo.findById(teamId);
  if (!team) {
    return refuse(ApiError.notFound(`Team ${teamId} not found.`), { ...audit, detail: { teamId } });
  }
  if (!team.is_active) {
    return refuse(ApiError.conflict(`Team '${team.name}' is already archived.`), { ...audit, teamId });
  }

  return withTransaction(async (db) => {
    const removed = await teamMembersRepo.removeAllFromTeam(teamId, db);
    for (const member of removed) {
      await auditRepo.record({
        actorUserId,
        action: "MEMBER_REMOVED",
        targetUserId: member.user_id,
        teamId,
        detail: { reason: "Team archived", wasLead: member.is_lead },
      }, db);
    }
    const archived = await teamsRepo.archive(teamId, db);
    await auditRepo.record({ ...audit, teamId, detail: { membersRemoved: removed.length } }, db);
    return { ...archived, membersRemoved: removed.length };
  });
}

// ── Members ──────────────────────────────────────────────────────────────────

// Refuses (and audits) if this user can't be made a lead of `team`.
async function assertCanLead(user, team, audit) {
  if (user.role !== "LEAD") {
    return refuse(
      ApiError.conflict(`${displayName(user)} has role ${user.role}. Change their role to LEAD first.`),
      audit
    );
  }
  const ledTeam = await teamMembersRepo.findLedTeam(user.user_id);
  if (ledTeam && String(ledTeam.team_id) !== String(team.team_id)) {
    return refuse(
      ApiError.conflict(`${displayName(user)} already leads '${ledTeam.name}'. A user can lead only one team.`),
      audit
    );
  }
}

async function addMember(teamId, { userId, isLead = false }, actorUserId) {
  const audit = { actorUserId, action: "MEMBER_ADDED", targetUserId: null };
  const team = await loadActiveTeam(teamId, audit);
  const teamAudit = { ...audit, teamId };

  const user = await usersRepo.findById(userId);
  if (!user) {
    return refuse(ApiError.notFound(`User ${userId} not found.`), { ...teamAudit, detail: { userId } });
  }
  const userAudit = { ...teamAudit, targetUserId: user.user_id, detail: { isLead } };

  if (user.is_active === false) {
    return refuse(ApiError.conflict(`${displayName(user)} is inactive and can't join a team.`), userAudit);
  }
  if (user.role === "ADMIN") {
    return refuse(ApiError.conflict(`${displayName(user)} is an admin. Admins aren't team members.`), userAudit);
  }
  if (await teamMembersRepo.find(teamId, userId)) {
    return refuse(ApiError.conflict(`${displayName(user)} is already a member of '${team.name}'.`), userAudit);
  }
  if (isLead) {
    await assertCanLead(user, team, userAudit);
  }

  try {
    return await withTransaction(async (db) => {
      const member = await teamMembersRepo.add({ teamId, userId, isLead, addedBy: actorUserId }, db);
      await auditRepo.record(userAudit, db);
      return member;
    });
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      return refuse(
        ApiError.conflict(`${displayName(user)} was just added to a team or made a lead by someone else. Refresh and try again.`),
        userAudit
      );
    }
    throw err;
  }
}

async function setLead(teamId, userId, isLead, actorUserId) {
  const action = isLead ? "LEAD_SET" : "LEAD_UNSET";
  const team = await loadActiveTeam(teamId, { actorUserId, action });
  const audit = { actorUserId, action, teamId, targetUserId: null };

  const membership = await teamMembersRepo.find(teamId, userId);
  if (!membership) {
    return refuse(
      ApiError.notFound(`User ${userId} is not a member of '${team.name}'.`),
      { ...audit, detail: { userId } }
    );
  }
  const user = await usersRepo.findById(userId);
  const userAudit = { ...audit, targetUserId: user.user_id };

  if (isLead) {
    if (membership.is_lead) {
      return refuse(ApiError.conflict(`${displayName(user)} already leads '${team.name}'.`), userAudit);
    }
    await assertCanLead(user, team, userAudit);
  } else if (!membership.is_lead) {
    return refuse(ApiError.conflict(`${displayName(user)} is not a lead of '${team.name}'.`), userAudit);
  }

  try {
    return await withTransaction(async (db) => {
      const updated = await teamMembersRepo.setLead(teamId, userId, isLead, db);
      await auditRepo.record(userAudit, db);
      return updated;
    });
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      return refuse(ApiError.conflict(`${displayName(user)} was just made lead of another team. Refresh and try again.`), userAudit);
    }
    throw err;
  }
}

/**
 * Removes a member from a team.
 * When teams can hand out access (team pools), this must first, in order:
 *   1. run each affected service's pre-removal check (e.g. Drive: no owned files),
 *   2. revoke the access the member got through this team,
 * and only then remove the membership. Teams grant nothing yet, so there is
 * nothing to check or revoke.
 */
async function removeMember(teamId, userId, actorUserId) {
  const audit = { actorUserId, action: "MEMBER_REMOVED", targetUserId: null };
  const team = await loadActiveTeam(teamId, audit);

  const membership = await teamMembersRepo.find(teamId, userId);
  if (!membership) {
    return refuse(
      ApiError.notFound(`User ${userId} is not a member of '${team.name}'.`),
      { ...audit, teamId, detail: { userId } }
    );
  }

  return withTransaction(async (db) => {
    const removed = await teamMembersRepo.remove(teamId, userId, db);
    await auditRepo.record({
      ...audit,
      teamId,
      targetUserId: Number(userId),
      detail: { wasLead: removed.is_lead },
    }, db);
    return removed;
  });
}

/**
 * Called inside the caller's transaction when a user's role changes away from
 * LEAD (role edit, reset to USER, or deactivation): clears their lead flag and
 * audits it, so no non-LEAD is left leading a team.
 */
async function clearLeadOnRoleChange(userId, newRole, actorUserId, db) {
  const teams = await teamMembersRepo.clearLeadForUser(userId, db);
  for (const { team_id: teamId } of teams) {
    await auditRepo.record({
      actorUserId,
      action: "LEAD_UNSET",
      targetUserId: Number(userId),
      teamId,
      detail: { reason: `Role changed to ${newRole}` },
    }, db);
  }
}

module.exports = {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  archiveTeam,
  addMember,
  setLead,
  removeMember,
  clearLeadOnRoleChange,
};
