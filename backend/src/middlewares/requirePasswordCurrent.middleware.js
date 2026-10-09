/**
 * @file requirePasswordCurrent.middleware.js
 * @description Blocks privileged routes while a forced password change is
 * outstanding.
 *
 * Previously this was enforced only by a modal in the React app, which meant
 * any direct API client could ignore it. Mount after requireAuth, and leave
 * /auth/change-password, /auth/me and /auth/logout exempt so the user has a
 * way out.
 */

"use strict";

const ApiError = require("../utils/ApiError");

function requirePasswordCurrent(req, res, next) {
  if (!req.user) {
    return next(ApiError.unauthorized("Authentication required."));
  }

  if (req.user.requiresPasswordChange) {
    return next(
      ApiError.forbidden(
        "A password change is required before you can use the console. Please set a new password."
      )
    );
  }

  next();
}

module.exports = requirePasswordCurrent;
