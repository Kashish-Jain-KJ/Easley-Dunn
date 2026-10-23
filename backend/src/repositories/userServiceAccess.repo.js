/**
 * @file userServiceAccess.repo.js
 * @description SQL for the user_service_access table.
 *
 * The admin screens still run this table's queries inline in
 * users.controller.js. Moving those is a separate piece of work; the query
 * below is the same one the admin access pane uses, so when they do move there
 * is one copy rather than two that have drifted.
 */

"use strict";

const { getPool } = require("../db/database");

/**
 * A user's live access, with the service each row points at and who granted it.
 *
 * LEFT JOIN, not JOIN: a row whose service is missing from the catalogue is
 * still access the person holds, and hiding it would hide the gap too.
 *
 * "Who granted it, and when" is read back out of the audit log, because this
 * table does not record it — it has no granted_by or granted_at column. That is
 * one of the things `grants` fixes (DESIGN.md section 4); until then the log is
 * the only place the answer exists. Access granted before the audit table
 * existed has no event, so both come back null and the screen shows a dash.
 *
 * @param {number|string} userId
 * @param {import("pg").Pool|import("pg").PoolClient} [db]
 */
async function listActiveByUser(userId, db = getPool()) {
  const { rows } = await db.query(
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
       s.is_active,
       g.created_at AS granted_at,
       g.actor_name AS granted_by
     FROM user_service_access usa
     LEFT JOIN services s ON s.service_id = usa.service_id
     LEFT JOIN LATERAL (
       SELECT e.created_at,
              -- performedBy is the fallback for an event with no actor user
              -- id. It is the one key of the event detail read on this side of
              -- the console, and it holds a display name — never an address, a
              -- browser or a failure reason.
              coalesce(
                nullif(btrim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')), ''),
                e.detail->>'performedBy'
              ) AS actor_name
         FROM audit_events e
         LEFT JOIN users a ON a.user_id = e.actor_user_id
        WHERE e.target_user_id = usa.user_id
          AND e.service_id = usa.service_id
          AND e.action = 'SERVICE_GRANTED'
          AND e.outcome = 'SUCCESS'
        ORDER BY e.created_at DESC
        LIMIT 1
     ) g ON true
     WHERE usa.user_id = $1 AND usa.is_active = true
     ORDER BY usa.access_id ASC`,
    [userId]
  );
  return rows;
}

module.exports = { listActiveByUser };
