/**
 * @file auth.routes.js
 * @description Secure Email & Password authentication routes.
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const requireAuth = require("../middlewares/requireAuth.middleware");
const { login, changePassword, getCurrentUser, logout } = require("../controllers/passwordAuth.controller");

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user with Email & Password
 *     description: Verifies credentials, issues a signed JWT session cookie, and returns user identity with console role.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@easleydunn.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "Password123!"
 *     responses:
 *       200:
 *         description: Successfully logged in. Session cookie is set.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Logged in successfully as ADMIN" }
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId: { type: integer, example: 1 }
 *                     email: { type: string, example: "admin@easleydunn.com" }
 *                     name: { type: string, example: "Admin User" }
 *                     role: { type: string, example: "ADMIN" }
 *                     requiresPasswordChange: { type: boolean, example: false }
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid credentials or password not configured
 *       403:
 *         description: Account is inactive or lacks console login permission
 */
router.post("/login", asyncHandler(login));

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change password for current logged-in user
 *     description: Validates current password, updates to new password, and clears requires_password_change flag.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Password changed successfully." }
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId: { type: integer }
 *                     email: { type: string }
 *                     name: { type: string }
 *                     role: { type: string }
 *                     requiresPasswordChange: { type: boolean, example: false }
 *       400:
 *         description: Invalid input or incorrect current password
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 */
router.post("/change-password", requireAuth, asyncHandler(changePassword));

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get currently authenticated user profile
 *     description: Returns the session user's ID, email, name, role, and password change status.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active session user data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId: { type: integer, example: 1 }
 *                     email: { type: string, example: "admin@easleydunn.com" }
 *                     name: { type: string, example: "Admin User" }
 *                     role: { type: string, example: "ADMIN" }
 *                     requiresPasswordChange: { type: boolean, example: false }
 *       401:
 *         description: Not authenticated
 */
router.get("/me", requireAuth, asyncHandler(getCurrentUser));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out current user
 *     description: Clears the HTTP-only session cookie.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Logged out successfully." }
 */
router.post("/logout", requireAuth, asyncHandler(logout));

module.exports = router;

