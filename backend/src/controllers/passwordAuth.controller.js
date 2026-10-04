/**
 * @file passwordAuth.controller.js
 * @description Authentication controller for secure Email & Password sign-in with forced password change support.
 */

"use strict";

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { getPool } = require("../db/database");
const ApiError = require("../utils/ApiError");
const { hasConsoleLoginPermission } = require("../config/roles.config");

const SESSION_TTL_DAYS = 7;
const PEPPER = process.env.PASSWORD_PEPPER || "cerberus-secret-pepper-key";

/**
 * POST /auth/login
 * Authenticates user with email and password.
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

  if (rows.length === 0) {
    throw ApiError.unauthorized("Invalid email or password.");
  }

  const user = rows[0];

  if (user.is_active === false) {
    throw ApiError.forbidden("Access Denied: This account is marked as inactive.");
  }

  const role = user.Role ? String(user.Role).toUpperCase() : null;

  if (!hasConsoleLoginPermission(role)) {
    throw ApiError.forbidden(
      "Access Denied: Your account has no assigned Cerberus console role. Please contact an Administrator."
    );
  }

  if (!user.password_hash) {
    throw ApiError.unauthorized(
      "No password configured for this account. Please ask an Administrator to grant your access credentials."
    );
  }

  // Verify password using bcrypt + server pepper
  const isValidPassword = bcrypt.compareSync(password + PEPPER, user.password_hash);
  if (!isValidPassword) {
    throw ApiError.unauthorized("Invalid email or password.");
  }

  // Update last_login_at
  await pool.query(
    `UPDATE easleydunn.users SET last_login_at = NOW() WHERE user_id = $1`,
    [user.user_id]
  );

  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
  const requiresPasswordChange = !!user.requires_password_change;

  const jwtSecret = process.env.AUTH_JWT_SECRET || "cerberus-default-jwt-secret-key";
  const sessionToken = jwt.sign(
    {
      userId: user.user_id,
      email: user.email,
      name: fullName,
      role: role,
      requiresPasswordChange: requiresPasswordChange,
    },
    jwtSecret,
    { expiresIn: `${SESSION_TTL_DAYS}d` }
  );

  res.cookie("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    message: `Logged in successfully as ${role}`,
    user: {
      userId: user.user_id,
      email: user.email,
      name: fullName,
      role: role,
      requiresPasswordChange: requiresPasswordChange,
    },
  });
}

/**
 * POST /auth/change-password
 * Allows logged in user to change their password, clearing requires_password_change flag.
 * Body: { currentPassword, newPassword }
 */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  if (!currentPassword || typeof currentPassword !== "string") {
    throw ApiError.badRequest("Current password is required.");
  }

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    throw ApiError.badRequest("New password must be at least 6 characters long.");
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT user_id, email, first_name, last_name, "Role", password_hash FROM easleydunn.users WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw ApiError.notFound("User not found.");
  }

  const user = rows[0];

  const isValidCurrent = bcrypt.compareSync(currentPassword + PEPPER, user.password_hash);
  if (!isValidCurrent) {
    throw ApiError.badRequest("Current password is incorrect.");
  }

  const newPasswordHash = bcrypt.hashSync(newPassword + PEPPER, 12);

  await pool.query(
    `UPDATE easleydunn.users 
     SET password_hash = $1, requires_password_change = false 
     WHERE user_id = $2`,
    [newPasswordHash, userId]
  );

  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
  const jwtSecret = process.env.AUTH_JWT_SECRET || "cerberus-default-jwt-secret-key";

  const sessionToken = jwt.sign(
    {
      userId: user.user_id,
      email: user.email,
      name: fullName,
      role: user.Role,
      requiresPasswordChange: false,
    },
    jwtSecret,
    { expiresIn: `${SESSION_TTL_DAYS}d` }
  );

  res.cookie("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    message: "Password changed successfully.",
    user: {
      userId: user.user_id,
      email: user.email,
      name: fullName,
      role: user.Role,
      requiresPasswordChange: false,
    },
  });
}

/**
 * GET /auth/me
 * Returns current logged-in identity from session.
 */
async function getCurrentUser(req, res) {
  if (!req.user) {
    throw ApiError.unauthorized("Not logged in.");
  }
  res.json({
    success: true,
    user: req.user,
  });
}

/**
 * POST /auth/logout
 * Clears session cookie.
 */
async function logout(req, res) {
  res.clearCookie("session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.json({ success: true, message: "Logged out successfully." });
}

module.exports = {
  login,
  changePassword,
  getCurrentUser,
  logout,
};
