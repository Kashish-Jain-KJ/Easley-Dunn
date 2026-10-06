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
 * @swagger
 * /admin/roles/grant:
 *   post:
 *     summary: Grant or update a user's Cerberus console role
 *     description: >
 *       Assigns or modifies console roles according to hierarchical RBAC rules.
 *       ADMIN can grant ADMIN, MANAGER, OPERATOR, or MEMBER.
 *       MANAGER can grant MANAGER, OPERATOR, or MEMBER.
 *       OPERATOR can grant OPERATOR or MEMBER.
 *     tags: [Roles & Permissions]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "operator@easleydunn.com"
 *               name:
 *                 type: string
 *                 example: "Jane Doe"
 *               role:
 *                 type: string
 *                 enum: [ADMIN, MANAGER, OPERATOR, MEMBER]
 *                 example: "OPERATOR"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: "Initial password for new console accounts (min 6 characters)"
 *                 example: "Passw0rd123!"
 *     responses:
 *       200:
 *         description: Role granted successfully and notification email dispatched.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Successfully granted 'OPERATOR' role to operator@easleydunn.com." }
 *                 emailSent: { type: boolean, example: true }
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId: { type: integer, example: 5 }
 *                     email: { type: string, example: "operator@easleydunn.com" }
 *                     role: { type: string, example: "OPERATOR" }
 *       400:
 *         description: Missing fields, invalid role, password too short, or self-modification blocked
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — Insufficient RBAC permission to grant target role
 */
router.post("/grant", requireAuth, requireRole("OPERATOR"), asyncHandler(grantRole));

/**
 * @swagger
 * /admin/roles/{userId}:
 *   delete:
 *     summary: Revoke Cerberus console role
 *     description: Resets user role to MEMBER and clears credentials according to hierarchy permissions.
 *     tags: [Roles & Permissions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to revoke role from
 *     responses:
 *       200:
 *         description: Role revoked successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Successfully revoked Cerberus console access for operator@easleydunn.com." }
 *       400:
 *         description: Self-revocation blocked
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permission to revoke target user's role
 *       404:
 *         description: User not found
 */
router.delete("/:userId", requireAuth, requireRole("OPERATOR"), asyncHandler(revokeRole));

/**
 * @swagger
 * /admin/roles/{userId}/status:
 *   patch:
 *     summary: Toggle user active / inactive status
 *     description: Toggles `is_active` boolean for an account. Blocked if target user still holds active third-party software permissions.
 *     tags: [Roles & Permissions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to toggle status
 *     responses:
 *       200:
 *         description: Status updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "User 'jane@company.com' is now Active." }
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId: { type: integer, example: 5 }
 *                     email: { type: string, example: "jane@company.com" }
 *                     isActive: { type: boolean, example: true }
 *       400:
 *         description: Self-deactivation blocked or active software permissions still exist
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permission to modify target user's status
 *       404:
 *         description: User not found
 */
router.patch("/:userId/status", requireAuth, requireRole("OPERATOR"), asyncHandler(toggleUserStatus));

/**
 * @swagger
 * /admin/roles/users:
 *   get:
 *     summary: List all users and their Cerberus console roles
 *     description: Returns registered users with console roles, active status, login history, and credential flags.
 *     tags: [Roles & Permissions]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User list returned.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count: { type: integer, example: 10 }
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId: { type: integer, example: 1 }
 *                       name: { type: string, example: "John Doe" }
 *                       email: { type: string, example: "john@easleydunn.com" }
 *                       role: { type: string, example: "ADMIN" }
 *                       isActive: { type: boolean, example: true }
 *                       hasPassword: { type: boolean, example: true }
 *                       lastLoginAt: { type: string, nullable: true }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permission
 */
router.get("/users", requireAuth, requireRole("OPERATOR"), asyncHandler(getRoleUsers));

module.exports = router;

