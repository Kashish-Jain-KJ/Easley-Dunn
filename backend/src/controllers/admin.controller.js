/**
 * @file admin.controller.js
 * @description Cerberus admin login — passwordless, magic-link only. No
 * signup form, no password anywhere. An existing ADMIN invites someone by
 * email; that email is the login.
 *
 * TEMPORARY: targets `users_duplicate`, not the real `users` table, while
 * the schema (the "Role" column, last_login_at, cerberus_admin_tokens) is
 * being validated. Swap every `users_duplicate` reference below back to
 * `users` once that validation is done and the real table has the same
 * columns — this file is the only thing that needs to change, the DB side
 * (cerberus_admin_tokens' FK, the real ALTER TABLE) is handled separately.
 *
 * `"Role"` (quoted, capitalized — Postgres enum easleydunn."Roles") is NULL
 * for a normal tracked employee, or one of ADMIN | DEV | TEMP for a Cerberus
 * admin. NULL and TEMP behave identically until existing endpoints are
 * gated in a later pass — that gating is explicitly out of scope here.
 *
 * POST /admin/invite → ADMIN-only. Sets/updates a user's Role, issues a
 *                       single-use magic-link token, emails it.
 * GET  /admin/login  → validates the token, marks it used, issues a session
 *                       cookie (JWT, 7 days), redirects into the dashboard.
 * GET  /admin/me     → returns the current session's identity.
 * POST /admin/logout → clears the session cookie.
 *
 * Required env:
 * AUTH_JWT_SECRET
 * MAIL_SMTP_HOSTNAME / MAIL_SMTP_PORT / MAIL_SMTP_USERNAME / MAIL_SMTP_PASSWORD / MAIL_FROM
 *   (already configured for kanboard.controller.js / discord.controller.js — reused here)
 *
 * Optional env:
 * ADMIN_MAGIC_LINK_TTL_MINUTES (default 30)
 */

"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getPool } = require("../db/database");
const { getMailTransporter } = require("../utils/mail");
const ApiError = require("../utils/ApiError");

const VALID_ROLES = ["ADMIN", "DEV", "TEMP"];
const SESSION_TTL_DAYS = 7;

function getMagicLinkTtlMinutes() {
  return parseInt(process.env.ADMIN_MAGIC_LINK_TTL_MINUTES || "30", 10);
}

function getAppBaseUrl() {
  return process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

async function sendMagicLinkEmail(toEmail, loginUrl) {
  const fromEmail = process.env.MAIL_FROM || process.env.MAIL_SMTP_USERNAME;
  const transporter = getMailTransporter();
  const ttlMinutes = getMagicLinkTtlMinutes();

  await transporter.sendMail({
    from: fromEmail,
    to: toEmail,
    subject: "Your Cerberus admin login link",
    text: `Hi,\n\nYou've been added as a Cerberus admin. This link is single-use and expires in ${ttlMinutes} minutes:\n\n${loginUrl}\n\nBest,\nCerberus`,
    html: `
      <p>Hi,</p>
      <p>You've been added as a Cerberus admin. This link is single-use and expires in ${ttlMinutes} minutes:</p>
      <p><a href="${loginUrl}">${loginUrl}</a></p>
      <p>Best,<br/>Cerberus</p>
    `,
  });
}

/**
 * POST /admin/invite
 * Requires an authenticated ADMIN caller (enforced here, not by a separate
 * role middleware — Part A only introduces requireAuth, not requireRole).
 * Body: { email, name?, role }
 */
async function inviteAdmin(req, res) {
  if (req.user.role !== "ADMIN") {
    throw ApiError.forbidden("Only an ADMIN can invite other admins.");
  }

  const { email, name } = req.body;
  const role = String(req.body.role || "").toUpperCase();

  if (!email || typeof email !== "string") {
    throw ApiError.badRequest("email is required.");
  }

  if (!VALID_ROLES.includes(role)) {
    throw ApiError.badRequest(`role must be one of ${VALID_ROLES.join(", ")}.`);
  }

  const pool = getPool();

  const { rows: existingRows } = await pool.query(
    `SELECT user_id FROM users_duplicate WHERE email = $1`,
    [email]
  );

  let userId;
  if (existingRows.length > 0) {
    userId = existingRows[0].user_id;
    await pool.query(
      `UPDATE users_duplicate SET "Role" = $1 WHERE user_id = $2`,
      [role, userId]
    );
  } else {
    const { first_name, last_name } = splitName(name);
    const { rows: insertedRows } = await pool.query(
      `INSERT INTO users_duplicate (first_name, last_name, email, is_active, "Role")
       VALUES ($1, $2, $3, true, $4)
       RETURNING user_id`,
      [first_name, last_name, email, role]
    );
    userId = insertedRows[0].user_id;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + getMagicLinkTtlMinutes() * 60 * 1000);

  await pool.query(
    `INSERT INTO cerberus_admin_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  const loginUrl = `${getAppBaseUrl()}/admin/login?token=${rawToken}`;

  let emailSent = false;
  try {
    await sendMagicLinkEmail(email, loginUrl);
    emailSent = true;
  } catch (mailError) {
    console.error("Failed to send Cerberus admin invite email:", mailError.message);
  }

  res.status(201).json({
    success: true,
    message: `Invited ${email} as ${role}.`,
    emailSent,
  });
}

/**
 * GET /admin/login?token=...
 * No auth required — this is the login itself. Validates the token, marks
 * it used, issues a session cookie, redirects into the dashboard.
 */
async function loginWithMagicLink(req, res) {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    throw ApiError.badRequest("token is required.");
  }

  const pool = getPool();
  const tokenHash = hashToken(token);

  const { rows } = await pool.query(
    `SELECT t.token_id, t.user_id, t.expires_at, t.used_at, u.email, u."Role"
     FROM cerberus_admin_tokens t
     JOIN users_duplicate u ON u.user_id = t.user_id
     WHERE t.token_hash = $1`,
    [tokenHash]
  );

  if (rows.length === 0) {
    throw ApiError.unauthorized("Invalid login link.");
  }

  const record = rows[0];

  if (record.used_at) {
    throw ApiError.unauthorized("This login link has already been used.");
  }

  if (new Date(record.expires_at) < new Date()) {
    throw ApiError.unauthorized("This login link has expired.");
  }

  await pool.query(
    `UPDATE cerberus_admin_tokens SET used_at = NOW() WHERE token_id = $1`,
    [record.token_id]
  );
  await pool.query(
    `UPDATE users_duplicate SET last_login_at = NOW() WHERE user_id = $1`,
    [record.user_id]
  );

  const sessionToken = jwt.sign(
    { userId: record.user_id, email: record.email, role: record.Role },
    process.env.AUTH_JWT_SECRET,
    { expiresIn: `${SESSION_TTL_DAYS}d` }
  );

  res.cookie("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });

  const redirectTarget = (process.env.CORS_ORIGINS || "").split(",")[0].trim() || "/";
  res.redirect(redirectTarget);
}

/**
 * GET /admin/me
 * Requires requireAuth. Returns the current session's identity.
 */
async function getCurrentAdmin(req, res) {
  res.json({ success: true, userId: req.user.userId, email: req.user.email, role: req.user.role });
}

/**
 * POST /admin/logout
 * Requires requireAuth.
 */
async function logoutAdmin(req, res) {
  res.clearCookie("session");
  res.json({ success: true, message: "Logged out." });
}

module.exports = { inviteAdmin, loginWithMagicLink, getCurrentAdmin, logoutAdmin };
