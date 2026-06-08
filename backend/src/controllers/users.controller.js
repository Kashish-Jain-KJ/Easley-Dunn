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
    "SELECT *, first_name || ' ' || last_name AS name FROM users ORDER BY user_id ASC"
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

/**
 * POST /users/:userId/access/:accessId/onboard
 * Manually updates user_service_access row to set is_active = true.
 */
async function onboardUserAccess(req, res) {
  const { userId, accessId } = req.params;

  // Verify access record exists
  const { rows } = await getPool().query(
    `SELECT usa.access_id, usa.service_id, s.service_name 
     FROM user_service_access usa
     LEFT JOIN services s ON s.service_id = usa.service_id
     WHERE usa.access_id = $1 AND usa.user_id = $2`,
    [accessId, userId]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `User service access record not found for user_id '${userId}' and access_id '${accessId}'.`
    });
  }

  const { service_id, service_name } = rows[0];

  // Update access record to active
  await getPool().query(
    `UPDATE user_service_access 
     SET is_active = true, last_synced_at = NOW() 
     WHERE access_id = $1`,
    [accessId]
  );

  // Log to log table
  await getPool().query(
    `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
     VALUES ($1, $2, 'ONBOARD', 'SUCCESS', NULL, NOW())`,
    [userId, service_id]
  );

  res.json({
    success: true,
    message: `Successfully manually onboarded service '${service_name}' for user_id '${userId}'.`
  });
}

/**
 * POST /users/:userId/access/:accessId/offboard
 * Manually updates user_service_access row to set is_active = false.
 */
async function offboardUserAccess(req, res) {
  const { userId, accessId } = req.params;

  // Verify access record exists
  const { rows } = await getPool().query(
    `SELECT usa.access_id, usa.service_id, s.service_name 
     FROM user_service_access usa
     LEFT JOIN services s ON s.service_id = usa.service_id
     WHERE usa.access_id = $1 AND usa.user_id = $2`,
    [accessId, userId]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `User service access record not found for user_id '${userId}' and access_id '${accessId}'.`
    });
  }

  const { service_id, service_name } = rows[0];

  // Update access record to inactive
  await getPool().query(
    `UPDATE user_service_access 
     SET is_active = false, last_synced_at = NOW() 
     WHERE access_id = $1`,
    [accessId]
  );

  // Log to log table
  await getPool().query(
    `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
     VALUES ($1, $2, 'OFFBOARD', 'SUCCESS', NULL, NOW())`,
    [userId, service_id]
  );

  res.json({
    success: true,
    message: `Successfully manually offboarded service '${service_name}' for user_id '${userId}'.`
  });
}

module.exports = { getUsers, getUserAccess, onboardUserAccess, offboardUserAccess };

