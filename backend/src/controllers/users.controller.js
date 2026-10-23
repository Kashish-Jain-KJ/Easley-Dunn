/**
 * @file users.controller.js
 * @description Request handlers for the /users resource (Tracked System Employees).
 *
 * GET  /users                → list all tracked system users
 * POST /users                → add a new tracked system user/employee
 * GET  /users/:userId/access → get access info for a specific user
 */

"use strict";

const { getPool } = require("../db/database");
const auditEvents = require("../repositories/auditEvents.repo");
const teamsService = require("../services/teams.service");
const { sendInvite } = require("../services/accountEmail.service");
const { verifyMail } = require("../utils/mail");
const ApiError = require("../utils/ApiError");
const { splitName } = require("../utils/userUtils");
const { logActivity } = require("../utils/logUtils");

/**
 * GET /users
 * Returns every row in the `users` table.
 */
async function getUsers(_req, res) {
  // Named columns, never `SELECT *`: that shipped every password hash to the
  // browser on each page load.
  const { rows } = await getPool().query(
    `SELECT user_id, email, first_name, last_name, "Role", is_active, start_date, last_login_at,
            (password_hash IS NOT NULL) AS has_password
       FROM users
      ORDER BY user_id ASC`
  );

  res.json({
    success: true,
    count: rows.length,
    data: rows.map((u) => ({
      ...u,
      id: u.user_id,
      name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
    })),
  });
}

/**
 * POST /users
 * Adds a new system user / employee to be tracked for onboarding and offboarding.
 * Body: { first_name, last_name, email }
 */
async function createSystemUser(req, res) {
  const { first_name, last_name, email, teamId } = req.body;

  if (!email || typeof email !== "string") {
    throw ApiError.badRequest("Email is required.");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pool = getPool();

  const { rows: existing } = await pool.query(
    "SELECT user_id FROM users WHERE LOWER(email) = $1",
    [normalizedEmail]
  );

  if (existing.length > 0) {
    throw ApiError.badRequest(`Someone with the email '${normalizedEmail}' is already here.`);
  }

  let finalFirstName = first_name || "";
  let finalLastName = last_name || "";

  if (!finalFirstName && !finalLastName) {
    const split = splitName(req.body.name);
    finalFirstName = split.first_name;
    finalLastName = split.last_name;
  }

  // No password is set here. The invite below is what lets them choose one,
  // so a password never exists in anyone's mailbox.
  const { rows } = await pool.query(
    `INSERT INTO users (first_name, last_name, email, is_active, start_date, "Role")
     VALUES ($1, $2, $3, true, CURRENT_DATE, 'USER')
     RETURNING user_id, first_name, last_name, email, is_active, start_date, "Role"`,
    [finalFirstName, finalLastName, normalizedEmail]
  );

  const newUser = rows[0];
  const formattedName = `${newUser.first_name || ""} ${newUser.last_name || ""}`.trim() || newUser.email;

  await auditEvents.record({
    actorUserId: req.user?.userId || null,
    action: "PERSON_ADDED",
    targetUserId: newUser.user_id,
    detail: { email: normalizedEmail },
  });

  // Joining a team goes through the teams service so it is checked and audited
  // the same way as adding someone from the team's own page.
  let teamName = null;
  let teamError = null;
  if (teamId) {
    try {
      const team = await teamsService.addMember(teamId, { userId: newUser.user_id }, req.user?.userId);
      teamName = (await teamsService.getTeam(team.team_id)).name;
    } catch (err) {
      teamError = err.message;
    }
  }

  const invite = await sendInvite({ user: newUser, teamName, actorUserId: req.user?.userId });

  res.status(201).json({
    success: true,
    message: invite.sent
      ? `${formattedName} added. An invite has been emailed to ${newUser.email}.`
      : `${formattedName} added, but the invite email could not be sent.`,
    inviteSent: invite.sent,
    // Returned so the admin can pass the link on by hand when mail is not set
    // up yet; it is the same one-time link that was emailed.
    inviteLink: invite.sent ? null : invite.link,
    inviteError: invite.error || null,
    teamError,
    data: {
      ...newUser,
      id: newUser.user_id,
      name: formattedName,
      team: teamName,
    },
  });
}

/**
 * GET /users/:userId/access
 * Returns access records associated with a specific user.
 */
async function getUserAccess(req, res) {
  const { userId } = req.params;

  const { rows: accessRows } = await getPool().query(
    `SELECT
       usa.access_id,
       usa.user_id,
       usa.external_account_identifier,
       usa.external_user_identifier,
       usa.role_name,
       usa.is_active AS access_is_active,
       usa.last_synced_at,
       s.service_id,
       s.service_name,
       s.service_code,
       s.is_active
     FROM user_service_access usa
     LEFT JOIN services s ON s.service_id = usa.service_id
     WHERE usa.user_id = $1 AND usa.is_active = true
     ORDER BY usa.access_id ASC`,
    [userId]
  );

  const data = accessRows.map(({ service_id, service_name, service_code, is_active, access_is_active, ...access }) => ({
    ...access,
    is_active: access_is_active,
    service: service_id != null
      ? { service_id, service_name, service_code, is_active }
      : null,
  }));

  res.json({
    success: true,
    userId,
    count: data.length,
    data,
  });
}

/**
 * POST /users/:userId/access/:accessId/onboard
 * Manually updates user_service_access row to set is_active = true.
 */
async function onboardUserAccess(req, res) {
  const { userId, accessId } = req.params;

  const { rows } = await getPool().query(
    `SELECT usa.access_id, usa.service_id, s.service_name 
     FROM user_service_access usa
     LEFT JOIN services s ON s.service_id = usa.service_id
     WHERE usa.access_id = $1 AND usa.user_id = $2`,
    [accessId, userId]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `User service access record not found for user_id '${userId}' and access_id '${accessId}'.`
    });
  }

  const { service_id, service_name } = rows[0];

  await getPool().query(
    `UPDATE user_service_access 
     SET is_active = true, last_synced_at = NOW() 
     WHERE access_id = $1`,
    [accessId]
  );

  await logActivity({
    userId,
    serviceId: service_id,
    commandType: "ONBOARD",
    status: "SUCCESS",
    performedBy: req.user?.name || req.user?.email || "System", actorUserId: req.user?.userId ?? null,
  });

  res.json({
    success: true,
    message: `Successfully manually onboarded service '${service_name}' for user_id '${userId}'.`
  });
}

/**
 * POST /users/:userId/access/:accessId/offboard
 * Manually updates user_service_access row to set is_active = false.
 */
async function offboardUserAccess(req, res) {
  const { userId, accessId } = req.params;

  const { rows } = await getPool().query(
    `SELECT usa.access_id, usa.service_id, s.service_name 
     FROM user_service_access usa
     LEFT JOIN services s ON s.service_id = usa.service_id
     WHERE usa.access_id = $1 AND usa.user_id = $2`,
    [accessId, userId]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `User service access record not found for user_id '${userId}' and access_id '${accessId}'.`
    });
  }

  const { service_id, service_name } = rows[0];

  await getPool().query(
    `UPDATE user_service_access 
     SET is_active = false, last_synced_at = NOW() 
     WHERE access_id = $1`,
    [accessId]
  );

  await logActivity({
    userId,
    serviceId: service_id,
    commandType: "OFFBOARD",
    status: "SUCCESS",
    performedBy: req.user?.name || req.user?.email || "System", actorUserId: req.user?.userId ?? null,
  });

  res.json({
    success: true,
    message: `Successfully manually offboarded service '${service_name}' for user_id '${userId}'.`
  });
}

/**
 * POST /users/:userId/invite
 *
 * Sends a fresh invite, which retires any earlier link. Separate from creating
 * the person on purpose: mail can fail or be lost long after an account exists,
 * so re-sending has to be something you can do at any time.
 */
async function resendInvite(req, res) {
  const { userId } = req.params;

  const { rows } = await getPool().query(
    `SELECT user_id, email, first_name, last_name, is_active, (password_hash IS NOT NULL) AS has_password
       FROM users WHERE user_id = $1`,
    [userId]
  );
  const user = rows[0];

  if (!user) throw ApiError.notFound("That person is no longer here.");
  if (!user.is_active) throw ApiError.conflict("This account is inactive. Activate it before inviting them.");
  if (user.has_password) {
    throw ApiError.conflict("They already have a password. Use Edit details to reset it instead.");
  }

  const invite = await sendInvite({ user, actorUserId: req.user?.userId });

  res.json({
    success: true,
    message: invite.sent
      ? `A new invite has been emailed to ${user.email}.`
      : "The invite email could not be sent, so pass this link on yourself.",
    inviteSent: invite.sent,
    inviteLink: invite.sent ? null : invite.link,
    inviteError: invite.error || null,
    expiresAt: invite.expiresAt,
  });
}

/** GET /users/mail-status — whether an invite could be emailed right now. */
async function mailStatus(_req, res) {
  const result = await verifyMail();
  res.json({ success: true, data: result });
}

module.exports = {
  resendInvite,
  mailStatus,
  getUsers,
  createSystemUser,
  getUserAccess,
  onboardUserAccess,
  offboardUserAccess,
};
