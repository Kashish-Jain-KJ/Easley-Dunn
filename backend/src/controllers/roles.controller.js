/**
 * @file roles.controller.js
 * @description Role delegation, editing, and revocation endpoints for ADMIN, MANAGER, and OPERATOR users.
 */

"use strict";

const bcrypt = require("bcryptjs");
const { getPool } = require("../db/database");
const ApiError = require("../utils/ApiError");
const { sendRoleNotificationEmail } = require("../services/roleEmail.service");
const { VALID_ROLES, ROLE_LEVELS } = require("../config/roles.config");
const { splitName } = require("../utils/userUtils");

const PEPPER = process.env.PASSWORD_PEPPER || "cerberus-secret-pepper-key";

/**
 * POST /admin/roles/grant
 * Requires OPERATOR, MANAGER, or ADMIN caller.
 * Body: { email, name?, role, password? }
 */
async function grantRole(req, res) {
  const callerRole = String(req.user.role || "").toUpperCase();
  const callerLevel = ROLE_LEVELS[callerRole] || 0;

  const { email, name, password } = req.body;
  const targetRole = String(req.body.role || "").toUpperCase();

  if (!email || typeof email !== "string") {
    throw ApiError.badRequest("email is required.");
  }

  if (!VALID_ROLES.includes(targetRole)) {
    throw ApiError.badRequest(`role must be one of: ${VALID_ROLES.join(", ")}.`);
  }

  const targetLevel = ROLE_LEVELS[targetRole] || 0;

  if (callerRole === "OPERATOR" && targetLevel > 2) {
    throw ApiError.forbidden("Access Operators can only assign 'MEMBER' or 'OPERATOR' roles.");
  }

  if (callerRole === "MANAGER" && targetRole === "ADMIN") {
    throw ApiError.forbidden("Access Managers cannot grant 'ADMIN' role access.");
  }

  if (callerLevel < targetLevel && callerRole !== "ADMIN") {
    throw ApiError.forbidden(`You do not have permission to grant the '${targetRole}' role.`);
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (normalizedEmail === String(req.user.email || "").toLowerCase()) {
    throw ApiError.badRequest("Self-modification blocked: You cannot modify or downgrade your own active logged-in account role.");
  }

  const pool = getPool();

  let passwordHash = null;
  if (password && typeof password === "string" && password.trim().length > 0) {
    if (password.length < 6) {
      throw ApiError.badRequest("Password must be at least 6 characters long.");
    }
    passwordHash = bcrypt.hashSync(password + PEPPER, 12);
  }

  const { rows: existingRows } = await pool.query(
    `SELECT user_id, email, first_name, last_name, "Role", password_hash FROM easleydunn.users WHERE LOWER(email) = $1`,
    [normalizedEmail]
  );

  let userId;
  if (existingRows.length > 0) {
    userId = existingRows[0].user_id;
    const currentTargetRole = String(existingRows[0].Role || "NONE").toUpperCase();
    const currentTargetLevel = ROLE_LEVELS[currentTargetRole] || 0;
    const hasExistingPassword = !!existingRows[0].password_hash;

    // Check if caller is allowed to edit existing user's role
    if (callerRole === "MANAGER" && currentTargetRole === "ADMIN") {
      throw ApiError.forbidden("Access Managers cannot edit an Admin account.");
    }
    if (callerRole === "OPERATOR" && currentTargetLevel > 1) {
      throw ApiError.forbidden("Access Operators cannot edit higher tier role accounts.");
    }

    if (targetRole !== "MEMBER" && !hasExistingPassword && !passwordHash) {
      throw ApiError.badRequest("An initial password is required to grant console role access (Operator, Manager, Admin) to a user who does not have a password yet.");
    }

    if (passwordHash) {
      await pool.query(
        `UPDATE easleydunn.users SET "Role" = $1, password_hash = $2, requires_password_change = true WHERE user_id = $3`,
        [targetRole, passwordHash, userId]
      );
    } else {
      await pool.query(
        `UPDATE easleydunn.users SET "Role" = $1 WHERE user_id = $2`,
        [targetRole, userId]
      );
    }
  } else {
    if (targetRole !== "MEMBER" && !passwordHash) {
      throw ApiError.badRequest("An initial password is required when creating and assigning console role access to a new user.");
    }

    const { first_name, last_name } = splitName(name);
    const { rows: insertedRows } = await pool.query(
      `INSERT INTO easleydunn.users (first_name, last_name, email, is_active, "Role", password_hash, requires_password_change)
       VALUES ($1, $2, $3, true, $4, $5, true)
       RETURNING user_id`,
      [first_name, last_name, normalizedEmail, targetRole, passwordHash]
    );
    userId = insertedRows[0].user_id;
  }

  // Trigger role notification email
  const emailSent = await sendRoleNotificationEmail({
    toEmail: normalizedEmail,
    role: targetRole,
    grantedBy: req.user.email,
  });

  res.status(200).json({
    success: true,
    message: `Successfully granted '${targetRole}' role to ${normalizedEmail}.`,
    emailSent,
    user: {
      userId,
      email: normalizedEmail,
      role: targetRole,
    },
  });
}

/**
 * DELETE /admin/roles/:userId
 * Revokes a user's Cerberus console role and login credentials.
 */
async function revokeRole(req, res) {
  const { userId } = req.params;
  const callerUserId = req.user.userId;
  const callerRole = String(req.user.role || "").toUpperCase();
  const callerLevel = ROLE_LEVELS[callerRole] || 0;

  if (String(callerUserId) === String(userId)) {
    throw ApiError.badRequest("You cannot revoke your own active Cerberus role.");
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT user_id, email, "Role" FROM easleydunn.users WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw ApiError.notFound("User not found.");
  }

  const targetUser = rows[0];
  const targetRole = String(targetUser.Role || "NONE").toUpperCase();
  const targetLevel = ROLE_LEVELS[targetRole] || 0;

  if (callerRole === "OPERATOR" && targetRole !== "OPERATOR") {
    throw ApiError.forbidden("Access Operators can only revoke 'OPERATOR' role access.");
  }

  if (callerRole === "MANAGER" && targetRole === "ADMIN") {
    throw ApiError.forbidden("Access Managers cannot revoke 'ADMIN' role access.");
  }

  if (callerLevel < targetLevel && callerRole !== "ADMIN") {
    throw ApiError.forbidden(`You do not have permission to revoke access for role '${targetRole}'.`);
  }

  await pool.query(
    `UPDATE easleydunn.users SET "Role" = 'MEMBER', password_hash = NULL WHERE user_id = $1`,
    [userId]
  );

  res.json({
    success: true,
    message: `Successfully revoked Cerberus console access for ${targetUser.email}.`,
  });
}

/**
 * GET /admin/roles/users
 * Returns list of all users and their assigned roles.
 */
async function getRoleUsers(req, res) {
  const pool = getPool();

  // Ensure all NULL or 'NONE' roles in the database are migrated to 'MEMBER'
  await pool.query(
    `UPDATE easleydunn.users SET "Role" = 'MEMBER' WHERE "Role" IS NULL OR "Role" = 'NONE'`
  );

  const { rows } = await pool.query(
    `SELECT user_id, first_name, last_name, email, is_active, "Role", last_login_at, password_hash
     FROM easleydunn.users
     ORDER BY user_id ASC`
  );

  const users = rows.map((u) => ({
    userId: u.user_id,
    name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
    email: u.email,
    role: u.Role || "MEMBER",
    isActive: u.is_active,
    hasPassword: !!u.password_hash,
    lastLoginAt: u.last_login_at,
  }));

  res.json({
    success: true,
    count: users.length,
    users,
  });
}

/**
 * PATCH /admin/roles/:userId/status
 * Toggles a user's active/inactive status (is_active boolean).
 */
async function toggleUserStatus(req, res) {
  const { userId } = req.params;
  const callerUserId = req.user.userId;
  const callerRole = String(req.user.role || "").toUpperCase();
  const callerLevel = ROLE_LEVELS[callerRole] || 0;

  if (String(callerUserId) === String(userId)) {
    throw ApiError.badRequest("Self-deactivation blocked: You cannot change your own active logged-in status.");
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT user_id, email, is_active, "Role" FROM easleydunn.users WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw ApiError.notFound("User not found.");
  }

  const targetUser = rows[0];
  const targetRole = String(targetUser.Role || "NONE").toUpperCase();
  const targetLevel = ROLE_LEVELS[targetRole] || 0;

  if (callerRole === "OPERATOR" && targetRole !== "MEMBER" && targetRole !== "OPERATOR") {
    throw ApiError.forbidden("Access Operators can only toggle status for 'MEMBER' or 'OPERATOR' roles.");
  }

  if (callerRole === "MANAGER" && targetRole === "ADMIN") {
    throw ApiError.forbidden("Access Managers cannot modify status for 'ADMIN' accounts.");
  }

  if (callerLevel < targetLevel && callerRole !== "ADMIN") {
    throw ApiError.forbidden(`You do not have permission to modify status for role '${targetRole}'.`);
  }

  const newIsActive = !targetUser.is_active;

  if (!newIsActive) {
    const { rows: activeAccessRows } = await pool.query(
      `SELECT usa.access_id, s.service_name
       FROM user_service_access usa
       JOIN services s ON s.service_id = usa.service_id
       WHERE usa.user_id = $1 AND usa.is_active = true`,
      [userId]
    );

    if (activeAccessRows.length > 0) {
      const activeServices = activeAccessRows.map((r) => `'${r.service_name}'`).join(", ");
      throw ApiError.badRequest(
        `Cannot deactivate user '${targetUser.email}' while they have active software permissions (${activeServices}). Please offboard software access permissions first.`
      );
    }
  }

  if (!newIsActive) {
    await pool.query(
      `UPDATE easleydunn.users SET is_active = false, "Role" = 'MEMBER' WHERE user_id = $1`,
      [userId]
    );
  } else {
    await pool.query(
      `UPDATE easleydunn.users SET is_active = true WHERE user_id = $1`,
      [userId]
    );
  }

  res.json({
    success: true,
    message: `User '${targetUser.email}' is now ${newIsActive ? "Active" : "Inactive"}.`,
    user: {
      userId: targetUser.user_id,
      email: targetUser.email,
      isActive: newIsActive,
    },
  });
}

module.exports = {
  grantRole,
  revokeRole,
  getRoleUsers,
  toggleUserStatus,
};
