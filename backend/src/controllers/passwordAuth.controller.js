/**
 * @file passwordAuth.controller.js
 * @description Email & password sign-in, backed by server-side sessions.
 *
 * The session cookie carries an opaque id only. Identity and role are resolved
 * from the database on each request by requireAuth.middleware.js.
 */

"use strict";

const bcrypt = require("bcryptjs");
const { getPool } = require("../db/database");
const ApiError = require("../utils/ApiError");
const appConfig = require("../config/app.config");
const { hasConsoleLoginPermission } = require("../config/roles.config");
const {
  establishSession,
  destroySession,
  revokeAllForUser,
} = require("../services/session.service");

const PEPPER = appConfig.passwordPepper;
const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 12;

/**
 * POST /auth/login
 * Body: { email, password }
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || typeof email !== "string") {
    throw ApiError.badRequest("Email is required.");
  }

  if (!password || typeof password !== "string") {
    throw ApiError.badRequest("Password is required.");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT user_id, email, first_name, last_name, "Role", is_active, password_hash, requires_password_change
     FROM easleydunn.users
     WHERE LOWER(email) = $1`,
    [normalizedEmail]
  );

  const user = rows[0];

  // One message and one code for every rejection below. Distinct responses for
  // "no such user", "inactive", "no console role" and "wrong password" let an
  // unauthenticated caller map the directory and spot console-capable accounts.
  const reject = () => {
    throw ApiError.unauthorized("Invalid email or password.");
  };

  if (!user || user.is_active === false || !user.password_hash) {
    // Still spend the bcrypt time so a missing account is not detectable by
    // how quickly the request comes back.
    await bcrypt.compare(password + PEPPER, "$2b$12$" + "x".repeat(53));
    reject();
  }

  const role = user.Role ? String(user.Role).toUpperCase() : null;

  if (!hasConsoleLoginPermission(role)) {
    await bcrypt.compare(password + PEPPER, user.password_hash);
    reject();
  }

  const isValidPassword = await bcrypt.compare(password + PEPPER, user.password_hash);
  if (!isValidPassword) {
    reject();
  }

  // Regenerates the session id before associating it with the user.
  await establishSession(req, user.user_id);

  await pool.query(
    `UPDATE easleydunn.users SET last_login_at = NOW() WHERE user_id = $1`,
    [user.user_id]
  );

  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;

  res.json({
    success: true,
    message: `Logged in successfully as ${role}`,
    user: {
      userId: user.user_id,
      email: user.email,
      name: fullName,
      role,
      requiresPasswordChange: !!user.requires_password_change,
    },
  });
}

/**
 * POST /auth/change-password
 * Body: { currentPassword, newPassword }
 *
 * Signs every other device out, then issues a fresh session id for this one.
 */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  if (!currentPassword || typeof currentPassword !== "string") {
    throw ApiError.badRequest("Current password is required.");
  }

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw ApiError.badRequest(
      `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
    );
  }

  if (newPassword === currentPassword) {
    throw ApiError.badRequest("New password must be different from the current password.");
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT user_id, email, first_name, last_name, "Role", password_hash
     FROM easleydunn.users WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw ApiError.notFound("User not found.");
  }

  const user = rows[0];

  // An account whose role was revoked has a NULL hash; bcrypt throws on a
  // non-string, which would surface as a 500.
  if (!user.password_hash) {
    throw ApiError.badRequest("Current password is incorrect.");
  }

  const isValidCurrent = await bcrypt.compare(currentPassword + PEPPER, user.password_hash);
  if (!isValidCurrent) {
    throw ApiError.badRequest("Current password is incorrect.");
  }

  const newPasswordHash = await bcrypt.hash(newPassword + PEPPER, BCRYPT_COST);

  await pool.query(
    `UPDATE easleydunn.users
        SET password_hash = $1, requires_password_change = false
      WHERE user_id = $2`,
    [newPasswordHash, userId]
  );

  // Changing a password signs out everywhere else, then re-establishes here.
  await revokeAllForUser(userId);
  await establishSession(req, userId);

  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;

  res.json({
    success: true,
    message: "Password changed successfully. Other devices have been signed out.",
    user: {
      userId: user.user_id,
      email: user.email,
      name: fullName,
      role: user.Role ? String(user.Role).toUpperCase() : null,
      requiresPasswordChange: false,
    },
  });
}

/**
 * GET /auth/me
 * Returns the identity requireAuth resolved for this request.
 */
async function getCurrentUser(req, res) {
  if (!req.user) {
    throw ApiError.unauthorized("Not logged in.");
  }
  res.json({ success: true, user: req.user });
}

/**
 * POST /auth/logout
 * Deletes the server-side session row, then clears the cookie.
 */
async function logout(req, res) {
  await destroySession(req, res);
  res.json({ success: true, message: "Logged out successfully." });
}

module.exports = {
  login,
  changePassword,
  getCurrentUser,
  logout,
};
