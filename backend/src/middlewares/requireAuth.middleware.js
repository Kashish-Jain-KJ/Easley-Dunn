/**
 * @file requireAuth.middleware.js
 * @description Resolves the server-side session into req.user.
 *
 * The session cookie carries an opaque id and nothing else. Role, active
 * status and the password-change flag are read from the database on every
 * request rather than trusted from the cookie, so a demotion, a deactivation
 * or a revoked role takes effect on the user's very next request instead of
 * whenever a token happens to expire.
 */

"use strict";

const { getPool } = require("../db/database");
const ApiError = require("../utils/ApiError");
const { hasConsoleLoginPermission } = require("../config/roles.config");
const { isExpiredByAbsoluteTimeout } = require("../services/session.service");

/** Destroys the session, then rejects the request. */
function endSession(req, next, message) {
  if (!req.session) return next(ApiError.unauthorized(message));
  req.session.destroy(() => next(ApiError.unauthorized(message)));
}

async function requireAuth(req, res, next) {
  // Mounted both at the router level and on individual routes; resolving once
  // per request avoids a second lookup.
  if (req.user) return next();

  const userId = req.session?.userId;
  if (!userId) {
    return next(ApiError.unauthorized("Not logged in."));
  }

  if (isExpiredByAbsoluteTimeout(req.session)) {
    return endSession(req, next, "Session expired — please log in again.");
  }

  let rows;
  try {
    ({ rows } = await getPool().query(
      `SELECT user_id, email, first_name, last_name, "Role", is_active, requires_password_change
         FROM easleydunn.users
        WHERE user_id = $1`,
      [userId]
    ));
  } catch (err) {
    return next(err);
  }

  const user = rows[0];

  // The account may have been deleted, deactivated or stripped of its console
  // role since this session was created.
  if (!user || user.is_active === false || !hasConsoleLoginPermission(user.Role)) {
    return endSession(req, next, "Session no longer valid — please log in again.");
  }

  req.user = {
    userId: user.user_id,
    email: user.email,
    name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
    role: String(user.Role).toUpperCase(),
    requiresPasswordChange: !!user.requires_password_change,
  };

  next();
}

module.exports = requireAuth;
