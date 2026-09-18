/**
 * @file admin.routes.js
 * @description Cerberus admin login routes, mounted at /admin.
 *
 * POST /admin/invite → ADMIN-only, gated by requireAuth (role checked in the controller)
 * GET  /admin/login  → public — this route IS the login, must never require auth
 * GET  /admin/me     → any logged-in role
 * POST /admin/logout → any logged-in role
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const requireAuth = require("../middlewares/requireAuth.middleware");
const { inviteAdmin, loginWithMagicLink, getCurrentAdmin, logoutAdmin } = require("../controllers/admin.controller");

const router = Router();

/**
 * @swagger
 * /admin/invite:
 *   post:
 *     summary: Invite a new Cerberus admin (ADMIN role only)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email: { type: string, example: "newdev@example.com" }
 *               name: { type: string, example: "New Dev" }
 *               role: { type: string, enum: [ADMIN, DEV, TEMP], example: "DEV" }
 *     responses:
 *       201:
 *         description: Invite created and emailed
 *       400:
 *         description: Missing or invalid email/role
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Logged in, but not an ADMIN
 */
router.post("/invite", requireAuth, asyncHandler(inviteAdmin));

/**
 * @swagger
 * /admin/login:
 *   get:
 *     summary: Validate a magic-link token and issue a session cookie
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Valid token — session cookie set, redirected into the dashboard
 *       400:
 *         description: Missing token
 *       401:
 *         description: Invalid, already-used, or expired token
 */
router.get("/login", asyncHandler(loginWithMagicLink));

/**
 * @swagger
 * /admin/me:
 *   get:
 *     summary: Get the current session's identity
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Current session identity
 *       401:
 *         description: Not logged in
 */
router.get("/me", requireAuth, asyncHandler(getCurrentAdmin));

/**
 * @swagger
 * /admin/logout:
 *   post:
 *     summary: Clear the session cookie
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Logged out
 *       401:
 *         description: Not logged in
 */
router.post("/logout", requireAuth, asyncHandler(logoutAdmin));

module.exports = router;
