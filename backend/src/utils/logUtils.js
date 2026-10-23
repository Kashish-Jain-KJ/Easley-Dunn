/**
 * @file logUtils.js
 * @description Records a service grant or revoke in `audit_events`.
 *
 * There is one audit log, not one per feature: a team change, a role change and
 * a service grant are all "someone changed what a person can reach", and they
 * carry the same fields. The old `log` table is no longer written to.
 */

"use strict";

const { getPool } = require("../db/database");
const auditEvents = require("../repositories/auditEvents.repo");
const logger = require("./logger");

const ACTIONS = {
  ONBOARD: "SERVICE_GRANTED",
  OFFBOARD: "SERVICE_REVOKED",
};

/**
 * @param {Object} params
 * @param {number|string} params.userId          whose access changed
 * @param {number|string|null} [params.serviceId]
 * @param {string} params.commandType            'ONBOARD' | 'OFFBOARD'
 * @param {string} params.status                 'SUCCESS' | 'FAILED'
 * @param {string|null} [params.errorMessage]
 * @param {number|string|null} [params.actorUserId]  who did it
 * @param {string|null} [params.performedBy]     display name, kept for rows
 *                                               where the actor is not a user
 * @param {import("pg").Pool|import("pg").PoolClient} [db]
 */
async function logActivity(
  { userId, serviceId = null, commandType, status, errorMessage = null, actorUserId = null, performedBy = null },
  db = getPool()
) {
  try {
    await auditEvents.record(
      {
        actorUserId: actorUserId || null,
        action: ACTIONS[commandType] || `SERVICE_${commandType}`,
        outcome: status === "SUCCESS" ? "SUCCESS" : "FAILED",
        targetUserId: userId || null,
        serviceId: serviceId || null,
        detail: {
          ...(errorMessage ? { reason: errorMessage } : {}),
          ...(performedBy && !actorUserId ? { performedBy } : {}),
        },
      },
      db
    );
  } catch (err) {
    // A failed audit write must not swallow the action's own error, but it is
    // worth shouting about: it means a change happened with no record.
    logger.error(`[audit] Could not record ${commandType} for user ${userId}: ${err.message}`);
  }
}

module.exports = {
  logActivity,
};
