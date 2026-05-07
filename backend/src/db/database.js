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
    pool = new Pool(dbConfig);
    pool.on("connect", (client) => {
      client.query(`SET search_path TO ${dbConfig.schema}`).catch((err) => {
        logger.error(`Failed to set search_path to ${dbConfig.schema}`, err);
      });
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
