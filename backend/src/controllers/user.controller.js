/**
 * @file user.controller.js
 * @description The signed-in person's own view of themselves: their access,
 * their teams, their history.
 *
 * Singular, and not to be confused with users.controller.js: that one is the
 * admin's view of *anyone*, reached as /users/:userId. Everything here takes
 * its subject from req.user and nothing else, so there is no id in any of
 * these URLs to tamper with and no ownership check that a later route can
 * forget to apply. GitHub draws the same line between /user and /users.
 *
 * Every role reaches these, admin included — an admin holds access of their
 * own and belongs to teams like anyone else.
 */

"use strict";

const userServiceAccess = require("../repositories/userServiceAccess.repo");
const teamMembers = require("../repositories/teamMembers.repo");
const auditEvents = require("../repositories/auditEvents.repo");

/**
 * GET /user/access
 * The services the caller currently holds.
 */
async function getOwnAccess(req, res) {
  const rows = await userServiceAccess.listActiveByUser(req.user.userId);

  // Same shape the admin access pane uses, plus where the grant came from.
  const data = rows.map(
    ({ service_id, service_name, service_code, is_active, access_is_active, granted_at, granted_by, ...access }) => ({
      ...access,
      is_active: access_is_active,
      grantedAt: granted_at,
      grantedBy: (granted_by || "").trim() || null,
      service: service_id != null
        ? { service_id, service_name, service_code, is_active }
        : null,
    })
  );

  // No access yet is an ordinary state for someone just onboarded, not a
  // failure: an empty list and a 200, for the screen to explain.
  res.json({ success: true, count: data.length, data });
}

/**
 * GET /user/team
 * The teams the caller belongs to, with their members.
 */
async function getOwnTeams(req, res) {
  const teams = await teamMembers.listByUser(req.user.userId);
  res.json({ success: true, count: teams.length, data: teams });
}

/**
 * One event as the caller's own history shows it. camelCase and nested to
 * match /audit, so the two read the same way — but with no ids for people or
 * teams, because nothing on this side of the console has a page to link to,
 * and no `detail`, which the repository never selects.
 */
function shape(row) {
  return {
    eventId: row.event_id,
    action: row.action,
    category: row.category,
    outcome: row.outcome,
    createdAt: row.created_at,
    actorName: (row.actor_name || "").trim() || null,
    team: row.team_name ? { name: row.team_name } : null,
    service: row.service_name ? { name: row.service_name } : null,
    byMe: !!row.by_me,
  };
}

/**
 * GET /user/activity
 * The caller's own history, newest first.
 */
async function getOwnActivity(req, res) {
  const { events, nextCursor } = await auditEvents.listForUser(req.user.userId, {
    before: req.query.before,
    limit: req.query.limit,
    category: req.query.category,
  });

  res.json({ success: true, count: events.length, nextCursor, data: events.map(shape) });
}

module.exports = { getOwnAccess, getOwnTeams, getOwnActivity };
