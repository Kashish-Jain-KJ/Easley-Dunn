/**
 * @file seed-dev-users.js
 * @description Creates one account per role for local work, so a developer can
 * sign in as the role they are testing instead of testing everything as an
 * admin and discovering the role rules only in production.
 *
 * Run with: npm run seed:dev
 *
 * These accounts have deliberately weak, shared passwords. That is acceptable
 * for a local database and nowhere else, so the script refuses to run when
 * NODE_ENV is production — see the guard below. The addresses end in
 * .test.invalid, a reserved TLD that can never resolve, which keeps them
 * obvious in a user list and makes any mail to them fail loudly.
 *
 * Re-running is safe: an existing account is updated, not duplicated.
 *
 * BEFORE GO-LIVE these rows must be deleted from whichever schema becomes
 * production. The accounts are listed in to-do/go-live.
 */

"use strict";

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const bcrypt = require("bcryptjs");
const { getPool } = require("../src/db/database");
const appConfig = require("../src/config/app.config");
const dbConfig = require("../src/config/db.config");

const BCRYPT_COST = 12;
const PEPPER = appConfig.passwordPepper;

const ACCOUNTS = [
  { email: "dev-admin@test.invalid", first: "Dev", last: "Admin", role: "ADMIN", password: "devadmin12345" },
  { email: "dev-lead@test.invalid", first: "Dev", last: "Lead", role: "LEAD", password: "devlead123456" },
  { email: "dev-user@test.invalid", first: "Dev", last: "User", role: "USER", password: "devuser123456" },
];

async function main() {
  if (appConfig.nodeEnv === "production") {
    throw new Error("seed-dev-users refuses to run with NODE_ENV=production. These are throwaway accounts.");
  }

  const pool = getPool();
  console.log(`Seeding dev accounts into schema "${dbConfig.schema}"\n`);

  for (const account of ACCOUNTS) {
    // Hashed the same way the app does, so these keep working if the hashing
    // changes only by being re-seeded — not by drifting out of sync here.
    const hash = await bcrypt.hash(account.password + PEPPER, BCRYPT_COST);

    const { rows } = await pool.query(
      `INSERT INTO users (email, first_name, last_name, "Role", is_active, password_hash,
                          requires_password_change, start_date)
            VALUES ($1, $2, $3, $4, true, $5, false, CURRENT_DATE)
       ON CONFLICT (email) DO UPDATE
            SET first_name = EXCLUDED.first_name,
                last_name  = EXCLUDED.last_name,
                "Role"     = EXCLUDED."Role",
                is_active  = true,
                password_hash = EXCLUDED.password_hash,
                requires_password_change = false
         RETURNING user_id, email, "Role",
                   (xmax = 0) AS created`,
      [account.email, account.first, account.last, account.role, hash]
    );

    const row = rows[0];
    console.log(
      `  ${row.created ? "created" : "updated"}  ${row.email.padEnd(24)} ${row.Role.padEnd(6)} password: ${account.password}`
    );
  }

  console.log("\nThese are local throwaway accounts. Delete them before go-live.");
  await pool.end();
}

main().catch((err) => {
  console.error(`\nSeeding failed: ${err.message}`);
  process.exit(1);
});
