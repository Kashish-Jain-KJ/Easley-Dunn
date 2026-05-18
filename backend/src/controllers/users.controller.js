/**
 * @file users.controller.js
 * @description Request handlers for the /users resource.
 *
 * GET /users                → list all users
 * GET /users/:userId/access → get access info for a specific user
 */

"use strict";

const { getPool } = require("../db/database");

/**
 * GET /users
 * Returns every row in the `users` table.
 */
async function getUsers(_req, res) {
  const { rows } = await getPool().query(
    "SELECT * FROM users ORDER BY user_id ASC"
  );

  res.json({
    success: true,
    count: rows.length,
    data: rows,
  });
}

/**
 * GET /users/:userId/access
 * Returns access records associated with a specific user.
 */
async function getUserAccess(req, res) {
  const { userId } = req.params;

  const { rows: accessRows } = await getPool().query(
    `SELECT
       usa.access_id,
       usa.user_id,
       usa.external_account_identifier,
       usa.external_user_identifier,
       usa.role_name,
       usa.is_automate,
       usa.is_active AS access_is_active,
       usa.last_synced_at,
       s.service_id,
       s.service_name,
       s.service_code,
       s.is_active
     FROM user_service_access usa
     LEFT JOIN services s ON s.service_id = usa.service_id
     WHERE usa.user_id = $1
     ORDER BY usa.access_id ASC`,
    [userId]
  );

  const data = accessRows.map(({ service_id, service_name, service_code, is_active, access_is_active, ...access }) => ({
    ...access,
    is_active: access_is_active,
    service: service_id != null
      ? { service_id, service_name, service_code, is_active }
      : null,
  }));

  res.json({
    success: true,
    userId,
    count: data.length,
    data,
  });
}

module.exports = { getUsers, getUserAccess };
