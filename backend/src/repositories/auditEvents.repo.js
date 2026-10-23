/**
 * @file auditEvents.repo.js
 * @description SQL for the append-only audit_events table.
 */

"use strict";

const { getPool } = require("../db/database");

/**
 * Which part of the console an event belongs to. Derived from the action so a
 * caller never has to remember to set it, and stored so it can be filtered on.
 */
const CATEGORIES = {
  SERVICE_: "ACCESS",
  MEMBER_: "MEMBERSHIP",
  LEAD_: "MEMBERSHIP",
  TEAM_: "TEAMS",
  SIGN_: "AUTH",
  PASSWORD_: "AUTH",
  SESSION_: "AUTH",
};

function categoryOf(action) {
  const prefix = Object.keys(CATEGORIES).find((p) => action.startsWith(p));
  return prefix ? CATEGORIES[prefix] : "PEOPLE";
}

/**
 * Appends one audit event.
 * @param {Object} event
 * @param {number|null} event.actorUserId    Who did it (null only for system jobs)
 * @param {string} event.action              e.g. "TEAM_CREATED", "SERVICE_GRANTED"
 * @param {"SUCCESS"|"FAILED"} [event.outcome]
 * @param {number|null} [event.targetUserId] The user the action was about
 * @param {number|null} [event.teamId]       Must be an existing team (FK)
 * @param {number|null} [event.serviceId]    Must be an existing service (FK)
 * @param {Object} [event.detail]            Anything else worth keeping
 * @param {import("pg").Pool|import("pg").PoolClient} [db]
 */
async function record(
  { actorUserId, action, outcome = "SUCCESS", targetUserId = null, teamId = null, serviceId = null, detail = {} },
  db = getPool()
) {
  await db.query(
    `INSERT INTO audit_events (actor_user_id, action, category, outcome, target_user_id, team_id, service_id, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [actorUserId, action, categoryOf(action), outcome, targetUserId, teamId, serviceId, JSON.stringify(detail)]
  );
}

const SELECT_EVENT = `
  SELECT e.event_id, e.action, e.category, e.outcome, e.detail, e.created_at,
         e.actor_user_id, e.target_user_id, e.team_id, e.service_id,
         btrim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')) AS actor_name,
         a.email AS actor_email,
         btrim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, '')) AS target_name,
         t.email AS target_email,
         tm.name AS team_name,
         s.service_name
    FROM audit_events e
    LEFT JOIN users a ON a.user_id = e.actor_user_id
    LEFT JOIN users t ON t.user_id = e.target_user_id
    LEFT JOIN teams tm ON tm.team_id = e.team_id
    LEFT JOIN services s ON s.service_id = e.service_id`;

/**
 * A page of events, newest first.
 *
 * Paged by "older than this event" rather than OFFSET: the log is append-only
 * and new rows arrive at the top, so an offset would shift entries between
 * pages and show some twice while hiding others.
 *
 * @param {Object} [filters]
 * @param {string} [filters.since]      ISO date; only events after it
 * @param {number} [filters.actorUserId]
 * @param {number} [filters.targetUserId]
 * @param {number} [filters.teamId]
 * @param {number} [filters.serviceId]
 * @param {string} [filters.action]
 * @param {string} [filters.outcome]
 * @param {string} [filters.before]     cursor: "<iso>|<event_id>"
 * @param {number} [filters.limit]
 */
async function list(filters = {}, db = getPool()) {
  const where = [];
  const values = [];
  const add = (sql, value) => {
    values.push(value);
    where.push(sql.replace("$?", `$${values.length}`));
  };

  if (filters.since) add("e.created_at >= $?", filters.since);
  if (filters.actorUserId) add("e.actor_user_id = $?", filters.actorUserId);
  if (filters.targetUserId) add("e.target_user_id = $?", filters.targetUserId);
  if (filters.teamId) add("e.team_id = $?", filters.teamId);
  if (filters.serviceId) add("e.service_id = $?", filters.serviceId);
  if (filters.action) add("e.action = $?", filters.action);
  if (filters.category) add("e.category = $?", filters.category);
  if (filters.outcome) add("e.outcome = $?", filters.outcome);

  if (filters.before) {
    const [ts, id] = String(filters.before).split("|");
    values.push(ts, id);
    where.push(`(e.created_at, e.event_id) < ($${values.length - 1}::timestamptz, $${values.length}::bigint)`);
  }

  // One extra row tells us whether there is another page without a count query.
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), 200);
  values.push(limit + 1);

  const { rows } = await db.query(
    `${SELECT_EVENT}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY e.created_at DESC, e.event_id DESC
      LIMIT $${values.length}`,
    values
  );

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    events: page,
    nextCursor: rows.length > limit && last ? `${last.created_at.toISOString()}|${last.event_id}` : null,
  };
}

/**
 * A page of one user's own history, newest first — what they did and what was
 * done to them, which `list` cannot express because its filters are ANDed.
 *
 * `detail` is deliberately absent from the column list rather than stripped
 * afterwards. It holds IP addresses, user agents and failure reasons, so the
 * safe thing is for it never to be in the result set at all: a later caller
 * cannot forget to remove what was never selected. The admin log keeps using
 * `list`, which still returns everything.
 *
 * @param {number|string} userId
 * @param {Object} [options]
 * @param {string} [options.before]  cursor: "<iso>|<event_id>"
 * @param {number} [options.limit]
 */
async function listForUser(userId, { before, limit: rawLimit, category } = {}, db = getPool()) {
  const values = [userId];
  const where = ["(e.actor_user_id = $1 OR e.target_user_id = $1)"];

  if (category) {
    values.push(category);
    where.push(`e.category = $${values.length}`);
  }

  if (before) {
    const [ts, id] = String(before).split("|");
    values.push(ts, id);
    where.push(`(e.created_at, e.event_id) < ($${values.length - 1}::timestamptz, $${values.length}::bigint)`);
  }

  const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 50, 1), 200);
  values.push(limit + 1);

  const { rows } = await db.query(
    `SELECT e.event_id, e.action, e.category, e.outcome, e.created_at,
            btrim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')) AS actor_name,
            tm.name AS team_name,
            s.service_name,
            (e.actor_user_id = $1) AS by_me
       FROM audit_events e
       LEFT JOIN users a ON a.user_id = e.actor_user_id
       LEFT JOIN teams tm ON tm.team_id = e.team_id
       LEFT JOIN services s ON s.service_id = e.service_id
      WHERE ${where.join(" AND ")}
      ORDER BY e.created_at DESC, e.event_id DESC
      LIMIT $${values.length}`,
    values
  );

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    events: page,
    nextCursor: rows.length > limit && last ? `${last.created_at.toISOString()}|${last.event_id}` : null,
  };
}

/** The distinct actions present, so the filter only offers what exists. */
async function listActions(db = getPool()) {
  const { rows } = await db.query("SELECT DISTINCT action FROM audit_events ORDER BY action");
  return rows.map((r) => r.action);
}

module.exports = { record, list, listForUser, listActions, categoryOf };
