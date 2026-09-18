/**
 * @file requireAuth.middleware.js
 * @description Verifies the JWT session cookie set by loginWithMagicLink and
 * attaches the decoded identity to req.user.
 *
 * Not wired into any existing route yet — only the new /admin routes that
 * need it apply it directly. Every other endpoint in Cerberus stays exactly
 * as unauthenticated as it is today.
 */

"use strict";

const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

function requireAuth(req, res, next) {
  const token = req.cookies?.session;

  if (!token) {
    return next(ApiError.unauthorized("Not logged in."));
  }

  try {
    const payload = jwt.verify(token, process.env.AUTH_JWT_SECRET);
    req.user = { userId: payload.userId, email: payload.email, role: payload.role };
    next();
  } catch (_error) {
    next(ApiError.unauthorized("Session expired or invalid — please log in again."));
  }
}

module.exports = requireAuth;
