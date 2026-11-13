/**
 * @file seed-initial-admin.js
 * @description Provisions the single initial ADMIN user for a fresh database.
 *
 * Run with:
 *   npm run seed:admin
 *
 * Reads configuration from environment variables (with fallbacks):
 *   INITIAL_ADMIN_EMAIL
 *   INITIAL_ADMIN_PASSWORD
 *   INITIAL_ADMIN_FIRST
 *   INITIAL_ADMIN_LAST
 *
 * Refuses to insert if any user with Role = 'ADMIN' already exists.
 */

"use strict";

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const bcrypt = require("bcryptjs");
const { getPool } = require("../src/db/database");
const appConfig = require("../src/config/app.config");
const dbConfig = require("../src/config/db.config");

const BCRYPT_COST = 12;

async function main() {
  const email = (process.env.INITIAL_ADMIN_EMAIL || "admin@easleydunn.local")
    .trim()
    .toLowerCase();
  const usingDefaultPassword = !process.env.INITIAL_ADMIN_PASSWORD;
  const password = process.env.INITIAL_ADMIN_PASSWORD || "CerberusAdmin123!";
  const firstName = (process.env.INITIAL_ADMIN_FIRST || "System").trim();
  const lastName = (process.env.INITIAL_ADMIN_LAST || "Admin").trim();

  if (!email) {
    throw new Error("INITIAL_ADMIN_EMAIL must not be empty.");
  }

  const pool = getPool();

  try {
    console.log(`Checking schema "${dbConfig.schema}" for an existing ADMIN user...`);

    const existingAdmin = await pool.query(
      `SELECT user_id, email
       FROM users
       WHERE "Role" = 'ADMIN'
       LIMIT 1`
    );

    if (existingAdmin.rows.length > 0) {
      const admin = existingAdmin.rows[0];
      console.log(
        `Aborting: an ADMIN user already exists (user_id: ${admin.user_id}, email: ${admin.email}). Only one initial admin can be provisioned.`
      );
      return;
    }

    const existingEmail = await pool.query(
      `SELECT user_id, email, "Role"
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email]
    );

    if (existingEmail.rows.length > 0) {
      const existing = existingEmail.rows[0];
      throw new Error(
        `Cannot provision admin: a user with email "${existing.email}" already exists with Role "${existing.Role}".`
      );
    }

    const passwordHash = await bcrypt.hash(password + appConfig.passwordPepper, BCRYPT_COST);

    const { rows } = await pool.query(
      `INSERT INTO users (
         email,
         first_name,
         last_name,
         "Role",
         is_active,
         password_hash,
         requires_password_change,
         start_date
       )
       VALUES ($1, $2, $3, 'ADMIN', true, $4, false, CURRENT_DATE)
       RETURNING user_id, email, first_name, last_name, "Role", is_active, start_date`,
      [email, firstName, lastName, passwordHash]
    );

    const created = rows[0];
    console.log(
      `Provisioned initial ADMIN user (user_id: ${created.user_id}, email: ${created.email}, name: ${created.first_name} ${created.last_name}).`
    );

    if (usingDefaultPassword) {
      console.warn(
        "WARNING: INITIAL_ADMIN_PASSWORD was not set; used fallback default password. Change it immediately after signing in."
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`\nAdmin seeding failed: ${err.message}`);
  process.exit(1);
});

