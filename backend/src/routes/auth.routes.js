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
 * POST /auth/login
 * Public endpoint for Email & Password authentication.
 */
router.post("/login", asyncHandler(login));

/**
 * POST /auth/change-password
 * Protected endpoint allowing user to change password and clear temporary status.
 */
router.post("/change-password", requireAuth, asyncHandler(changePassword));

/**
 * GET /auth/me
 * Protected endpoint returning active session user profile.
 */
router.get("/me", requireAuth, asyncHandler(getCurrentUser));

/**
 * POST /auth/logout
 * Protected endpoint to clear session cookie.
 */
router.post("/logout", requireAuth, asyncHandler(logout));

module.exports = router;
