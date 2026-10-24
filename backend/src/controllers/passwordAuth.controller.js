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
const { withTransaction } = require("../db/transaction");
const ApiError = require("../utils/ApiError");
const appConfig = require("../config/app.config");
const { hasConsoleLoginPermission } = require("../config/roles.config");
const auditEvents = require("../repositories/auditEvents.repo");
const logger = require("../utils/logger");
const inviteTokens = require("../repositories/inviteTokens.repo");
const {
  establishSession,
  destroySession,
  revokeAllForUser,
} = require("../services/session.service");
const { sendPasswordReset } = require("../services/accountEmail.service");

const PEPPER = appConfig.passwordPepper;
const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 12;

/**
 * Records a sign-in, sign-out or password event.
 *
 * These live in the same audit log as every other change: at this size a
 * separate sign-in store would be ceremony. The address and browser go in the
 * detail, because for a failed attempt they are the only identifying marks —
 * the attempt may carry an email nobody owns. A password is never recorded.
 */
async function recordAuth({ action, outcome = "SUCCESS", userId = null, email = null, reason = null, req }) {
  try {
    await auditEvents.record({
      actorUserId: userId,
      targetUserId: userId,
      action,
      outcome,
      detail: {
        ...(email && !userId ? { email } : {}),
        ...(reason ? { reason } : {}),
        ip: req.ip,
        userAgent: req.get("user-agent") || null,
      },
    });
  } catch (err) {
    logger.error(`[audit] Could not record ${action}: ${err.message}`);
  }
}

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
     FROM users
     WHERE LOWER(email) = $1`,
    [normalizedEmail]
  );

  const user = rows[0];

  // One message and one code for every rejection below. Distinct responses for
  // "no such user", "inactive", "no console role" and "wrong password" let an
  // unauthenticated caller map the directory and spot console-capable accounts.
  const reject = async (reason) => {
    // The caller is told one thing; the log keeps why, which is what makes a
    // run of failures readable afterwards.
    await recordAuth({
      action: "SIGN_IN",
      outcome: "FAILED",
      userId: user?.user_id || null,
      email: normalizedEmail,
      reason,
      req,
    });
    throw ApiError.unauthorized("Invalid email or password.");
  };

  if (!user || user.is_active === false || !user.password_hash) {
    // Still spend the bcrypt time so a missing account is not detectable by
    // how quickly the request comes back.
    await bcrypt.compare(password + PEPPER, "$2b$12$" + "x".repeat(53));
    await reject(!user ? "No such account" : user.is_active === false ? "Account is inactive" : "No password set");
  }

  const role = user.Role ? String(user.Role).toUpperCase() : null;

  if (!hasConsoleLoginPermission(role)) {
    await bcrypt.compare(password + PEPPER, user.password_hash);
    await reject(`Role ${role} cannot sign in`);
  }

  const isValidPassword = await bcrypt.compare(password + PEPPER, user.password_hash);
  if (!isValidPassword) {
    await reject("Wrong password");
  }

  // Regenerates the session id before associating it with the user.
  await establishSession(req, user.user_id);

  await pool.query(
    `UPDATE users SET last_login_at = NOW() WHERE user_id = $1`,
    [user.user_id]
  );

  await recordAuth({ action: "SIGN_IN", userId: user.user_id, req });

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
     FROM users WHERE user_id = $1`,
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
    `UPDATE users
        SET password_hash = $1, requires_password_change = false
      WHERE user_id = $2`,
    [newPasswordHash, userId]
  );

  // Changing a password signs out everywhere else, then re-establishes here.
  await revokeAllForUser(userId);
  await establishSession(req, userId);

  await recordAuth({ action: "PASSWORD_CHANGED", userId, req });

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
 * GET /auth/invite/:token
 *
 * Public. Says whether an invite is still usable and who it is for, so the page
 * can greet them. The token itself is the secret, so naming its owner reveals
 * nothing to anyone who does not already hold it.
 */
async function checkInvite(req, res) {
  const invite = await inviteTokens.findUsable(req.params.token);
  if (!invite) {
    throw new ApiError(410, "This invite link has already been used or has expired. Ask the admin for a new one.");
  }
  res.json({
    success: true,
    data: {
      email: invite.email,
      name: `${invite.first_name || ""} ${invite.last_name || ""}`.trim() || invite.email,
    },
  });
}

/**
 * POST /auth/forgot-password
 * Body: { email }
 *
 * Public. Emails a reset link if the address belongs to an account that can
 * sign in.
 *
 * The response is identical either way, and deliberately so: a different
 * answer for an unknown address turns this endpoint into a directory — anyone
 * could test addresses and learn which ones are real. That is why nothing here
 * throws on a miss, and why the audit event, which does record the difference,
 * is the only place it shows.
 */
async function requestPasswordReset(req, res) {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    throw ApiError.badRequest("Email is required.");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const { rows } = await getPool().query(
    `SELECT user_id, email, first_name, last_name, "Role", is_active
       FROM users
      WHERE LOWER(email) = $1`,
    [normalizedEmail]
  );
  const user = rows[0];
  const role = user?.Role ? String(user.Role).toUpperCase() : null;

  // Why it was not sent is worth keeping; it is just not worth telling the
  // caller. A run of these for addresses that do not exist is someone probing.
  const ignore = async (reason) => {
    await recordAuth({
      action: "PASSWORD_RESET_REQUESTED",
      outcome: "FAILED",
      userId: user?.user_id || null,
      email: normalizedEmail,
      reason,
      req,
    });
  };

  if (!user) {
    await ignore("No such account");
  } else if (user.is_active === false) {
    await ignore("Account is inactive");
  } else if (!hasConsoleLoginPermission(role)) {
    await ignore(`Role ${role} cannot sign in`);
  } else {
    await sendPasswordReset({ user });
  }

  res.json({
    success: true,
    message: "If that address has an account, a reset link is on its way. It expires in an hour.",
  });
}

/**
 * GET /auth/reset/:token
 *
 * Public. The reset counterpart of checkInvite.
 */
async function checkReset(req, res) {
  const reset = await inviteTokens.findUsable(req.params.token, "PASSWORD_RESET");
  if (!reset) {
    throw new ApiError(410, "This reset link has already been used or has expired. Request a new one from the sign-in page.");
  }
  res.json({
    success: true,
    data: {
      email: reset.email,
      name: `${reset.first_name || ""} ${reset.last_name || ""}`.trim() || reset.email,
    },
  });
}

/**
 * Spends a one-time token and sets the password it was issued for.
 *
 * Shared by the invite and the reset: they differ in their wording and in the
 * event they record, not in what they do. Nothing signs the person in — they go
 * to the sign-in page and use what they just chose, which also proves it works.
 */
async function setPasswordFromToken(req, res, { purpose, expired, action, message }) {
  const { password } = req.body;

  if (!password || typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw ApiError.badRequest(`Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  const token = await inviteTokens.findUsable(req.params.token, purpose);
  if (!token) {
    throw new ApiError(410, expired);
  }

  const passwordHash = await bcrypt.hash(password + PEPPER, BCRYPT_COST);

  // The password and the spent token move together: a failure must not leave a
  // usable link behind a set password, or a set password with the link intact.
  await withTransaction(async (db) => {
    await db.query(
      `UPDATE users SET password_hash = $1, requires_password_change = false WHERE user_id = $2`,
      [passwordHash, token.user_id]
    );
    await inviteTokens.markUsed(token.token_id, db);
    await auditEvents.record(
      {
        actorUserId: token.user_id,
        targetUserId: token.user_id,
        action,
        detail: { ip: req.ip, userAgent: req.get("user-agent") || null },
      },
      db
    );
  });

  // No session may outlive the password it was created under. A brand-new
  // account has none; for a reset it is the point of the exercise, because the
  // reason for resetting may be that someone else is signed in. Outside the
  // transaction on purpose: the session table is not part of the
  // password-and-token invariant above, and a failure here must not roll back a
  // password the person has already chosen.
  await revokeAllForUser(token.user_id);

  res.json({ success: true, message });
}

/**
 * POST /auth/invite/:token
 * Body: { password }
 */
async function acceptInvite(req, res) {
  return setPasswordFromToken(req, res, {
    purpose: "INVITE",
    expired: "This invite link has already been used or has expired. Ask the admin for a new one.",
    action: "INVITE_ACCEPTED",
    message: "Your password is set. You can sign in now.",
  });
}

/**
 * POST /auth/reset/:token
 * Body: { password }
 */
async function acceptReset(req, res) {
  return setPasswordFromToken(req, res, {
    purpose: "PASSWORD_RESET",
    expired: "This reset link has already been used or has expired. Request a new one from the sign-in page.",
    action: "PASSWORD_RESET",
    message: "Your password has been reset. You can sign in now.",
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
  const userId = req.user?.userId || null;
  await destroySession(req, res);
  await recordAuth({ action: "SIGN_OUT", userId, req });
  res.json({ success: true, message: "Logged out successfully." });
}

module.exports = {
  checkInvite,
  acceptInvite,
  requestPasswordReset,
  checkReset,
  acceptReset,
  login,
  changePassword,
  getCurrentUser,
  logout,
};
