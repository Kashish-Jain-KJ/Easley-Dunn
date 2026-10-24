/**
 * @file audit.controller.js
 * @description Reads the audit log. Nothing here writes: rows are appended by
 * whichever service made the change, in the same transaction as the change.
 */

"use strict";

const auditEvents = require("../repositories/auditEvents.repo");

function personOf(name, email, id) {
  if (!id) return null;
  return { userId: id, name: (name || "").trim() || email, email };
}

function shape(row) {
  return {
    eventId: row.event_id,
    action: row.action,
    category: row.category,
    outcome: row.outcome,
    createdAt: row.created_at,
    actor: personOf(row.actor_name, row.actor_email, row.actor_user_id),
    target: personOf(row.target_name, row.target_email, row.target_user_id),
    team: row.team_id ? { teamId: row.team_id, name: row.team_name } : null,
    service: row.service_id ? { serviceId: row.service_id, name: row.service_name } : null,
    detail: row.detail || {},
  };
}

/**
 * GET /audit
 * Query: since, actorUserId, targetUserId, teamId, serviceId, action, outcome,
 *        before (cursor), limit
 */
async function listAudit(req, res) {
  const { events, nextCursor } = await auditEvents.list(req.query);
  res.json({
    success: true,
    count: events.length,
    nextCursor,
    data: events.map(shape),
  });
}

/** GET /audit/actions — the actions actually present, for the filter. */
async function listActions(_req, res) {
  res.json({ success: true, data: await auditEvents.listActions() });
}

module.exports = { listAudit, listActions };
