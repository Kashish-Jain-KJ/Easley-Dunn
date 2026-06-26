/**
 * @file db.config.js
 * @description PostgreSQL database connection configuration.
 *
 * Configured for Supabase PostgreSQL via a single connection string.
 */

"use strict";

const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  schema: process.env.DB_SCHEMA || "public",
  max: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

module.exports = dbConfig;
