/**
 * @file roles.controller.js
 * @description Role assignment, editing, and revocation endpoints. ADMIN only (enforced at the route).
 */

"use strict";

const bcrypt = require("bcryptjs");
const { getPool } = require("../db/database");
const ApiError = require("../utils/ApiError");
const { sendRoleNotificationEmail } = require("../services/roleEmail.service");
const { ASSIGNABLE_ROLES } = require("../config/roles.config");
const { splitName } = require("../utils/userUtils");
const appConfig = require("../config/app.config");
const { revokeAllForUser } = require("../services/session.service");
const { withTransaction } = require("../db/transaction");
const { clearLeadOnRoleChange } = require("../services/teams.service");

const PEPPER = appConfig.passwordPepper;

/**
 * Runs a role-changing UPDATE. If it moves a user off LEAD, their team lead flag
 * is cleared and audited in the same transaction, so no non-LEAD leads a team.
 */
async function updateRole(sql, params, { userId, fromRole, toRole, actorUserId }) {
  if (fromRole !== "LEAD" || toRole === "LEAD") {
    await getPool().query(sql, params);
    return;
  }
  await withTransaction(async (db) => {
    await db.query(sql, params);
    await clearLeadOnRoleChange(userId, toRole, actorUserId, db);
  });
}
const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 12;

/**
 * POST /admin/roles/grant
 * Requires ADMIN caller. Assigns LEAD or USER; ADMIN cannot be granted here.
 * Body: { email, name?, role, password? }
 */
async function grantRole(req, res) {
  const { email, name, password } = req.body;
  const targetRole = String(req.body.role || "").toUpperCase();

  if (!email || typeof email !== "string") {
    throw ApiError.badRequest("email is required.");
  }

  if (!ASSIGNABLE_ROLES.includes(targetRole)) {
    throw ApiError.badRequest(`role must be one of: ${ASSIGNABLE_ROLES.join(", ")}.`);
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (normalizedEmail === String(req.user.email || "").toLowerCase()) {
    throw ApiError.badRequest("Self-modification blocked: You cannot modify or downgrade your own active logged-in account role.");
  }

  const pool = getPool();

  let passwordHash = null;
  if (password && typeof password === "string" && password.trim().length > 0) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw ApiError.badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }
    passwordHash = await bcrypt.hash(password + PEPPER, BCRYPT_COST);
  }

  const { rows: existingRows } = await pool.query(
    `SELECT user_id, email, first_name, last_name, "Role", password_hash FROM users WHERE LOWER(email) = $1`,
    [normalizedEmail]
  );

  let userId;
  if (existingRows.length > 0) {
    userId = existingRows[0].user_id;
    const currentTargetRole = String(existingRows[0].Role || "NONE").toUpperCase();
    const hasExistingPassword = !!existingRows[0].password_hash;

    if (currentTargetRole === "ADMIN") {
      throw ApiError.forbidden("Admin accounts cannot be edited through the API.");
    }

    // Every role can log in, so every account needs a password.
    if (!hasExistingPassword && !passwordHash) {
      throw ApiError.badRequest("An initial password is required for a user who does not have a password yet.");
    }

    if (passwordHash) {
      await updateRole(
        `UPDATE users SET "Role" = $1, password_hash = $2, requires_password_change = true WHERE user_id = $3`,
        [targetRole, passwordHash, userId],
        { userId, fromRole: currentTargetRole, toRole: targetRole, actorUserId: req.user.userId }
      );
      // Credentials were reset by an administrator — sign the user out everywhere.
      await revokeAllForUser(userId);
    } else {
      await updateRole(
        `UPDATE users SET "Role" = $1 WHERE user_id = $2`,
        [targetRole, userId],
        { userId, fromRole: currentTargetRole, toRole: targetRole, actorUserId: req.user.userId }
      );
      // OWASP: a privilege level change must not be inherited by a session
      // that predates it. The change is made by an admin from a different
      // session, so the target's session id cannot be regenerated in place —
      // ending their sessions and forcing a fresh login is the equivalent.
      // Guarded on an actual change so re-saving the same role is a no-op.
      if (currentTargetRole !== targetRole) {
        await revokeAllForUser(userId);
      }
    }
  } else {
    if (!passwordHash) {
      throw ApiError.badRequest("An initial password is required when creating a new user.");
    }

    const { first_name, last_name } = splitName(name);

    const { rows: insertedRows } = await pool.query(
      `INSERT INTO users (first_name, last_name, email, is_active, "Role", password_hash, requires_password_change)
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
 * Resets a user's role to USER. Login is kept (every role can log in);
 * withdrawing login is deactivation (PATCH /admin/roles/:userId/status).
 */
async function revokeRole(req, res) {
  const { userId } = req.params;
  const callerUserId = req.user.userId;

  if (String(callerUserId) === String(userId)) {
    throw ApiError.badRequest("You cannot revoke your own active Cerberus role.");
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT user_id, email, "Role" FROM users WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw ApiError.notFound("User not found.");
  }

  const targetUser = rows[0];
  const targetRole = String(targetUser.Role || "NONE").toUpperCase();

  if (targetRole === "ADMIN") {
    throw ApiError.forbidden("Admin accounts cannot be edited through the API.");
  }

  await updateRole(
    `UPDATE users SET "Role" = 'USER' WHERE user_id = $1`,
    [userId],
    { userId, fromRole: targetRole, toRole: "USER", actorUserId: callerUserId }
  );

  // A privilege change must not be inherited by a session that predates it.
  await revokeAllForUser(userId);

  res.json({
    success: true,
    message: `Role for ${targetUser.email} reset to 'USER'.`,
  });
}

/**
 * GET /admin/roles/users
 * Returns list of all users and their assigned roles.
 */
async function getRoleUsers(req, res) {
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT user_id, first_name, last_name, email, is_active, "Role", last_login_at, password_hash
     FROM users
     ORDER BY user_id ASC`
  );

  const users = rows.map((u) => ({
    userId: u.user_id,
    name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
    email: u.email,
    // Shown as stored; legacy values (MEMBER etc.) remain until the roles migration.
    role: u.Role ? String(u.Role).toUpperCase() : "NONE",
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

  if (String(callerUserId) === String(userId)) {
    throw ApiError.badRequest("Self-deactivation blocked: You cannot change your own active logged-in status.");
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT user_id, email, is_active, "Role" FROM users WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw ApiError.notFound("User not found.");
  }

  const targetUser = rows[0];
  const targetRole = String(targetUser.Role || "NONE").toUpperCase();

  if (targetRole === "ADMIN") {
    throw ApiError.forbidden("Admin accounts cannot be edited through the API.");
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
    await updateRole(
      `UPDATE users SET is_active = false, "Role" = 'USER' WHERE user_id = $1`,
      [userId],
      { userId, fromRole: targetRole, toRole: "USER", actorUserId: callerUserId }
    );
    // Deactivation takes effect immediately, including for anyone logged in.
    await revokeAllForUser(userId);
  } else {
    await pool.query(
      `UPDATE users SET is_active = true WHERE user_id = $1`,
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
