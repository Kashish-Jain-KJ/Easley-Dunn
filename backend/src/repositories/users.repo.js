/**
 * @file users.repo.js
 * @description SQL for the users table. Only what new code needs so far; older
 * controllers still run their own queries until they are ported.
 */

"use strict";

const { getPool } = require("../db/database");

async function findById(userId, db = getPool()) {
  const { rows } = await db.query(
    `SELECT user_id, email, first_name, last_name, "Role" AS role, is_active
       FROM users
      WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = { findById };
