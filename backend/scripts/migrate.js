#!/usr/bin/env node
/**
 * @file migrate.js
 * @description Runs node-pg-migrate against the schema in DB_SCHEMA, so
 * migrations always hit the same schema the app uses.
 *
 * Usage (from backend/):
 *   npm run migrate up              apply all pending migrations
 *   npm run migrate down            roll back the last migration
 *   npm run migrate create <name>   new empty SQL migration in migrations/
 *   npm run migrate up -- --dry-run print the SQL without running it
 */

"use strict";

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const { spawnSync } = require("child_process");

const schema = process.env.DB_SCHEMA;
const args = process.argv.slice(2);

// Refuse to guess. Without this, node-pg-migrate falls back to "public".
if (!schema && args[0] !== "create") {
  console.error("DB_SCHEMA is not set. Set it in backend/.env (e.g. DB_SCHEMA=refactor).");
  process.exit(1);
}

const cliArgs = [
  ...args,
  "--migrations-dir", "migrations",
  "--migration-file-language", "sql",
  "--check-order",
];

if (schema) {
  // Migration history is stored in <schema>.pgmigrations.
  cliArgs.push("--schema", schema);
}

// Mirrors the app's SSL setting (src/config/db.config.js).
if (process.env.DB_SSL !== "false") {
  cliArgs.push("--reject-unauthorized", "false");
}

const bin = path.join(__dirname, "..", "node_modules", "node-pg-migrate", "bin", "node-pg-migrate.js");
const result = spawnSync(process.execPath, [bin, ...cliArgs], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
});

process.exit(result.status ?? 1);
