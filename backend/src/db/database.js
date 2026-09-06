/**
 * @file database.js
 * @description Creates and exports a PostgreSQL connection pool.
 */

"use strict";

const { Pool } = require("pg");
const dbConfig = require("../config/db.config");
const logger = require("../utils/logger");

let pool;

/**
 * Returns the singleton connection pool, creating it on first call.
 * @returns {Pool}
 */
function getPool() {
  if (!pool) {
    // search_path is set via connection startup options, not a follow-up
    // SET query on "connect" — a follow-up query races the first real query
    // on that same new connection and can lose, silently querying the wrong
    // schema. Startup options are applied by Postgres before any query can run.
    pool = new Pool({
      ...dbConfig,
      options: `-c search_path=${dbConfig.schema}`,
    });
    logger.info(`PostgreSQL pool created using DATABASE_URL`);
  }
  return pool;
}

/**
 * Verifies that the database is reachable.
 * Called once at startup so the process exits early on misconfiguration.
 * @returns {Promise<void>}
 */
async function testConnection() {
  const client = await getPool().connect();
  logger.info("✅  Database connection verified.");
  client.release();
}

module.exports = { getPool, testConnection };
