/**
 * @file users.controller.js
 * @description Request handlers for the /users resource (Tracked System Employees).
 *
 * GET  /users                → list all tracked system users
 * POST /users                → add a new tracked system user/employee
 * GET  /users/:userId/access → get access info for a specific user
 */

"use strict";

const { getPool } = require("../db/database");
const ApiError = require("../utils/ApiError");
const { splitName } = require("../utils/userUtils");
const { logActivity } = require("../utils/logUtils");

/**
 * GET /users
 * Returns every row in the `users` table.
 */
async function getUsers(_req, res) {
  const { rows } = await getPool().query(
    "SELECT *, first_name || ' ' || last_name AS name FROM easleydunn.users ORDER BY user_id ASC"
  );

  res.json({
    success: true,
    count: rows.length,
    data: rows.map((u) => ({
      ...u,
      id: u.user_id,
      name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
    })),
  });
}

/**
 * POST /users
 * Adds a new system user / employee to be tracked for onboarding and offboarding.
 * Body: { first_name, last_name, email }
 */
async function createSystemUser(req, res) {
  const { first_name, last_name, email } = req.body;

  if (!email || typeof email !== "string") {
    throw ApiError.badRequest("Email is required.");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pool = getPool();

  const { rows: existing } = await pool.query(
    "SELECT user_id FROM easleydunn.users WHERE LOWER(email) = $1",
    [normalizedEmail]
  );

  if (existing.length > 0) {
    throw ApiError.badRequest(`A system user with email '${normalizedEmail}' is already registered.`);
  }

  let finalFirstName = first_name || "";
  let finalLastName = last_name || "";

  if (!finalFirstName && !finalLastName) {
    const split = splitName(req.body.name);
    finalFirstName = split.first_name;
    finalLastName = split.last_name;
  }

  const { rows } = await pool.query(
    `INSERT INTO easleydunn.users (first_name, last_name, email, is_active, start_date, "Role")
     VALUES ($1, $2, $3, true, CURRENT_DATE, 'MEMBER')
     RETURNING user_id, first_name, last_name, email, is_active, start_date, "Role"`,
    [finalFirstName, finalLastName, normalizedEmail]
  );

  const newUser = rows[0];
  const formattedName = `${newUser.first_name || ""} ${newUser.last_name || ""}`.trim() || newUser.email;

  res.status(201).json({
    success: true,
    message: `Registered system user '${formattedName}' (${newUser.email}) successfully.`,
    data: {
      ...newUser,
      id: newUser.user_id,
      name: formattedName,
    },
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
       usa.is_active AS access_is_active,
       usa.last_synced_at,
       s.service_id,
       s.service_name,
       s.service_code,
       s.is_active
     FROM user_service_access usa
     LEFT JOIN services s ON s.service_id = usa.service_id
     WHERE usa.user_id = $1 AND usa.is_active = true
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

  await getPool().query(
    `UPDATE user_service_access 
     SET is_active = true, last_synced_at = NOW() 
     WHERE access_id = $1`,
    [accessId]
  );

  await logActivity({ userId, serviceId: service_id, commandType: "ONBOARD", status: "SUCCESS" });

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

  await getPool().query(
    `UPDATE user_service_access 
     SET is_active = false, last_synced_at = NOW() 
     WHERE access_id = $1`,
    [accessId]
  );

  await logActivity({ userId, serviceId: service_id, commandType: "OFFBOARD", status: "SUCCESS" });

  res.json({
    success: true,
    message: `Successfully manually offboarded service '${service_name}' for user_id '${userId}'.`
  });
}

/**
 * GET /users/:userId/logs
 * Returns activity log records for a specific user from the `log` table.
 */
async function getUserLogs(req, res) {
  const { userId } = req.params;

  const { rows: logRows } = await getPool().query(
    `SELECT
       l.id,
       l.user_id,
       l.service_id,
       l.command_type,
       l.status,
       l.error_message,
       l.created_at,
       s.service_name,
       s.service_code
     FROM log l
     LEFT JOIN services s ON s.service_id = l.service_id
     WHERE l.user_id = $1
     ORDER BY l.created_at DESC, l.id DESC`,
    [userId]
  );

  const total = logRows.length;
  const successCount = logRows.filter((r) => r.status === "SUCCESS").length;
  const failedCount = logRows.filter((r) => r.status === "FAILED").length;

  res.json({
    success: true,
    userId,
    count: total,
    summary: {
      total,
      success: successCount,
      failed: failedCount,
    },
    data: logRows,
  });
}

module.exports = {
  getUsers,
  createSystemUser,
  getUserAccess,
  onboardUserAccess,
  offboardUserAccess,
  getUserLogs,
};
