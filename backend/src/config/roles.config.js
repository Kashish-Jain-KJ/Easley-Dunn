/**
 * @file roles.config.js
 * @description Centralized Role-Based Access Control (RBAC) Single Source of Truth.
 */

"use strict";

const ROLES = {
  ADMIN: {
    name: "ADMIN",
    title: "Admin",
    tier: 1,
    level: 3,
    canLoginConsole: true,
    description: "Admin (the professor; full system control)",
  },
  LEAD: {
    name: "LEAD",
    title: "Team Lead",
    tier: 2,
    level: 2,
    canLoginConsole: true,
    description: "Team Lead (grants access from their team's pool to their team's members)",
  },
  USER: {
    name: "USER",
    title: "User",
    tier: 3,
    level: 1,
    canLoginConsole: true,
    description: "User (student; sees and requests their own access)",
  },
};

// Roles the API may assign. ADMIN is deliberately absent: the professor is the
// only admin, so no request can create or edit an ADMIN account.
const ASSIGNABLE_ROLES = ["LEAD", "USER"];

const VALID_ROLES = Object.keys(ROLES);

const ROLE_LEVELS = Object.fromEntries(
  Object.values(ROLES).map((r) => [r.name, r.level])
);

const CONSOLE_LOGIN_ROLES = Object.values(ROLES)
  .filter((r) => r.canLoginConsole)
  .map((r) => r.name);

function hasConsoleLoginPermission(role) {
  if (!role) return false;
  const normalized = String(role).toUpperCase();
  return CONSOLE_LOGIN_ROLES.includes(normalized);
}

module.exports = {
  ROLES,
  VALID_ROLES,
  ASSIGNABLE_ROLES,
  ROLE_LEVELS,
  CONSOLE_LOGIN_ROLES,
  hasConsoleLoginPermission,
};
