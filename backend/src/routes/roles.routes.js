/**
 * @file roles.routes.js
 * @description Role delegation, editing, and revocation routes.
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const requireAuth = require("../middlewares/requireAuth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");
const { grantRole, revokeRole, getRoleUsers, toggleUserStatus } = require("../controllers/roles.controller");

const router = Router();

/**
 * POST /admin/roles/grant
 * Protected endpoint requiring minimum OPERATOR role.
 * ADMIN can grant ADMIN, MANAGER, or OPERATOR.
 * MANAGER can grant MANAGER or OPERATOR.
 * OPERATOR can grant OPERATOR.
 */
router.post("/grant", requireAuth, requireRole("OPERATOR"), asyncHandler(grantRole));

/**
 * DELETE /admin/roles/:userId
 * Protected endpoint to revoke role access according to hierarchy rules.
 */
router.delete("/:userId", requireAuth, requireRole("OPERATOR"), asyncHandler(revokeRole));

/**
 * PATCH /admin/roles/:userId/status
 * Toggles a user's active/inactive status.
 */
router.patch("/:userId/status", requireAuth, requireRole("OPERATOR"), asyncHandler(toggleUserStatus));

/**
 * GET /admin/roles/users
 * Protected endpoint returning all registered users and their Cerberus roles.
 */
router.get("/users", requireAuth, requireRole("OPERATOR"), asyncHandler(getRoleUsers));

module.exports = router;
