/**
 * @file connectorResults.js
 * @description Reads the per-target rows a connector returns and says what
 * actually happened.
 *
 * Each connector that touches more than one target — Drive folders, BigQuery
 * projects, Discord guilds — answers with `data: [{ access_id, status, error,
 * … }]`, one row per target, `status` being "onboarded" / "kicked" /
 * "removed" or "failed".
 *
 * The toast used to read `row.name` and `row.success`, which no connector has
 * ever sent. Both came back undefined, so every row showed a blank label and
 * the word "Failed" — including the rows that worked. This is the one place
 * that understands the real shape, so there is nothing left to guess at.
 *
 * It also decides the outcome of the whole operation, which is three states
 * and not two. A request where one of two folders failed is not a success, and
 * the old top-level flag called it one.
 */

/** Statuses that mean the target was actually changed. */
const OK_STATUSES = new Set(["onboarded", "kicked", "removed", "revoked", "granted"]);

/**
 * Which target a row is about. No connector sends a human name yet — the
 * catalogue (`resources.name`, DESIGN.md section 4) is what will fix that —
 * so until then this falls back through the external ids each one does send.
 */
function labelOf(row) {
  return (
    row.name ||
    row.folderId ||
    row.project ||
    row.guild ||
    row.parentResource ||
    row.email ||
    (row.access_id != null ? `Access ${row.access_id}` : "Unknown target")
  );
}

function toItem(row) {
  // A boolean `success`, if a connector ever sends one, wins over the status
  // string. Nothing sends one today.
  const ok =
    typeof row.success === "boolean" ? row.success : OK_STATUSES.has(String(row.status || "").toLowerCase());

  return { label: labelOf(row), ok, error: row.error || null };
}

/**
 * @param {Array<Object>} [rows] the connector's `data` array
 * @returns {{items: Array, okCount: number, failCount: number, total: number,
 *            outcome: "ok"|"partial"|"failed"|null}}
 *          `outcome` is null when there are no rows to judge by — a
 *          single-target connector, or a request that failed before it got far
 *          enough to touch anything. The caller falls back to the response's
 *          own success flag there.
 */
export function summarize(rows) {
  const items = (rows || []).map(toItem);
  const okCount = items.filter((item) => item.ok).length;
  const failCount = items.length - okCount;

  let outcome = null;
  if (items.length > 0) {
    if (failCount === 0) outcome = "ok";
    else if (okCount === 0) outcome = "failed";
    else outcome = "partial";
  }

  return { items, okCount, failCount, total: items.length, outcome };
}
