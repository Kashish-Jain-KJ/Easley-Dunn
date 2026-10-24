/**
 * @file transaction.js
 * @description Runs several queries as one all-or-nothing unit (the equivalent of
 * Spring's @Transactional). Used to keep a change and its audit entry together.
 */

"use strict";

const { getPool } = require("./database");

/**
 * Runs `work(db)` inside BEGIN/COMMIT on a single connection. If `work` throws,
 * everything it did is rolled back and the same error is re-thrown, so the
 * caller still sees the specific failure.
 *
 * Pass `db` to every repository call inside `work`; calls that don't pass it
 * run on the pool, outside the transaction.
 *
 * @template T
 * @param {(db: import("pg").PoolClient) => Promise<T>} work
 * @returns {Promise<T>}
 */
async function withTransaction(work) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
