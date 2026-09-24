/**
 * @file requireRole.middleware.js
 * @description Role-Based Access Control (RBAC) middleware enforcing minimum
 * role level in the hierarchy (OPERATOR: 1, MANAGER: 2, ADMIN: 3).
 */

"use strict";

const ApiError = require("../utils/ApiError");
const { ROLE_LEVELS } = require("../config/roles.config");

/**
 * Middleware factory enforcing a minimum role level.
 * @param {"OPERATOR" | "MANAGER" | "ADMIN"} minRole
 */
function requireRole(minRole) {
  const requiredLevel = ROLE_LEVELS[minRole];
  if (!requiredLevel) {
    throw new Error(`Invalid minRole specified in requireRole middleware: ${minRole}`);
  }

  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required."));
    }

    const userRole = String(req.user.role || "").toUpperCase();
    const userLevel = ROLE_LEVELS[userRole] || 0;

    if (userLevel < requiredLevel) {
      return next(
        ApiError.forbidden(
          `Forbidden: Action requires minimum role '${minRole}'. Your current role is '${userRole || "NONE"}'.`
        )
      );
    }

    next();
  };
}

module.exports = requireRole;
