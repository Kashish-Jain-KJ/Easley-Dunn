/**
 * @file roles.config.js
 * @description Centralized Role-Based Access Control (RBAC) Single Source of Truth.
 */

"use strict";

const ROLES = {
  ADMIN: {
    name: "ADMIN",
    title: "Super Admin",
    tier: 1,
    level: 4,
    canLoginConsole: true,
    description: "Super Admin (Full system control and role delegation)",
  },
  MANAGER: {
    name: "MANAGER",
    title: "Access Manager",
    tier: 2,
    level: 3,
    canLoginConsole: true,
    description: "Access Manager (Delegate operator access & onboard/offboard users)",
  },
  OPERATOR: {
    name: "OPERATOR",
    title: "Access Operator",
    tier: 3,
    level: 2,
    canLoginConsole: true,
    description: "Access Operator (Onboard and offboard users across integrated software)",
  },
  MEMBER: {
    name: "MEMBER",
    title: "Standard Member",
    tier: 4,
    level: 1,
    canLoginConsole: false,
    description: "Standard Member (Onboarded System Employee)",
  },
};

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

function getAssignableRoles(callerRole) {
  const normCaller = String(callerRole || "").toUpperCase();
  const callerLevel = ROLE_LEVELS[normCaller] || 0;
  return Object.values(ROLES)
    .filter((r) => r.level <= callerLevel)
    .map((r) => r.name);
}

module.exports = {
  ROLES,
  VALID_ROLES,
  ROLE_LEVELS,
  CONSOLE_LOGIN_ROLES,
  hasConsoleLoginPermission,
  getAssignableRoles,
};
