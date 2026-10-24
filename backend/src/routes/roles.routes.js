/**
 * @file roles.routes.js
 * @description Role delegation, editing, and revocation routes.
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const requireAuth = require("../middlewares/requireAuth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");
const { grantRole, toggleUserStatus } = require("../controllers/roles.controller");

const router = Router();

/**
 * @swagger
 * /admin/roles/grant:
 *   post:
 *     summary: Grant or update a user's Cerberus console role
 *     description: >
 *       ADMIN only. Assigns LEAD or USER to a new or existing user.
 *       ADMIN cannot be granted, and existing ADMIN accounts cannot be edited.
 *       An initial password is required if the user has none (every role can log in).
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
 *                 example: "lead@easleydunn.com"
 *               name:
 *                 type: string
 *                 example: "Jane Doe"
 *               role:
 *                 type: string
 *                 enum: [LEAD, USER]
 *                 example: "LEAD"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: "Initial password, required if the user has none (min 12 characters)"
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
 *                 message: { type: string, example: "Successfully granted 'LEAD' role to lead@easleydunn.com." }
 *                 emailSent: { type: boolean, example: true }
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId: { type: integer, example: 5 }
 *                     email: { type: string, example: "lead@easleydunn.com" }
 *                     role: { type: string, example: "LEAD" }
 *       400:
 *         description: Missing fields, invalid role, password too short, or self-modification blocked
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — caller is not ADMIN, or target is an ADMIN account
 */
router.post("/grant", requireAuth, requireRole("ADMIN"), asyncHandler(grantRole));


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
 *         description: Caller is not ADMIN, or target is an ADMIN account
 *       404:
 *         description: User not found
 */
router.patch("/:userId/status", requireAuth, requireRole("ADMIN"), asyncHandler(toggleUserStatus));


module.exports = router;

