/**
 * @file auditEvents.repo.js
 * @description SQL for the append-only audit_events table.
 */

"use strict";

const { getPool } = require("../db/database");

/**
 * Appends one audit event.
 * @param {Object} event
 * @param {number|null} event.actorUserId    Who did it (null only for system jobs)
 * @param {string} event.action              e.g. "TEAM_CREATED", "MEMBER_ADDED"
 * @param {"SUCCESS"|"FAILED"} [event.outcome]
 * @param {number|null} [event.targetUserId] The user the action was about
 * @param {number|null} [event.teamId]       Must be an existing team (FK)
 * @param {Object} [event.detail]            Anything else worth keeping (reason, before/after)
 * @param {import("pg").Pool|import("pg").PoolClient} [db]
 */
async function record(
  { actorUserId, action, outcome = "SUCCESS", targetUserId = null, teamId = null, detail = {} },
  db = getPool()
) {
  await db.query(
    `INSERT INTO audit_events (actor_user_id, action, outcome, target_user_id, team_id, detail)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorUserId, action, outcome, targetUserId, teamId, JSON.stringify(detail)]
  );
}

module.exports = { record };
