/**
 * @file index.routes.js
 * @description Root router — mounts all feature routers under the API prefix.
 *
 * Add new feature routers here as the project grows.
 */

"use strict";

const { Router } = require("express");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const rolesRoutes = require("./roles.routes");
const usersRoutes = require("./users.routes");
const servicesRoutes = require("./services.routes");
const googlePlayRoutes = require("./googlePlay.routes");
const bigQueryRoutes = require("./bigQuery.routes");
const googleDriveRoutes = require("./googleDrive.routes");
const googleAnalyticsRoutes = require("./googleAnalytics.routes");
const appleStoreConnectRoutes = require("./appleStoreConnect.routes");
const googleCloudRoutes = require("./googleCloud.routes");
const firebaseRoutes = require("./firebase.routes");
const kanboardRoutes = require("./kanboard.routes");
const { discordRoutes, discordPublicRoutes } = require("./discord.routes");
const teamsRoutes = require("./teams.routes");
const auditRoutes = require("./audit.routes");
const userRoutes = require("./user.routes");

const requireAuth = require("../middlewares/requireAuth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");
const requirePasswordCurrent = require("../middlewares/requirePasswordCurrent.middleware");

const router = Router();

// Public routes
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
// Employee-facing Discord routes — no Cerberus session, ever. Must be mounted
// here, ahead of the gated /discord block below, so these match first.
router.use("/discord", discordPublicRoutes);

// Signed in, any role: the caller's own access, teams and history. Its own
// guard list rather than an absent one — a route must never become reachable
// by omission. requirePasswordCurrent stays: someone who still owes a password
// change has no business reading data, and /auth/change-password is exempt so
// they have a way out.
const signedIn = [requireAuth, requirePasswordCurrent];

router.use("/user", signedIn, userRoutes);

// Protected RBAC routes (ADMIN only)
const rbacAdmin = [requireAuth, requirePasswordCurrent, requireRole("ADMIN")];

router.use("/users", rbacAdmin, usersRoutes);
router.use("/services", rbacAdmin, servicesRoutes);
router.use("/google-play", rbacAdmin, googlePlayRoutes);
router.use("/bigquery", rbacAdmin, bigQueryRoutes);
router.use("/google-drive", rbacAdmin, googleDriveRoutes);
router.use("/google-analytics", rbacAdmin, googleAnalyticsRoutes);
router.use(["/appleStoreConnect", "/appleStoreConnet"], rbacAdmin, appleStoreConnectRoutes);
router.use("/google-cloud", rbacAdmin, googleCloudRoutes);
router.use("/firebase", rbacAdmin, firebaseRoutes);
router.use("/kanboard", rbacAdmin, kanboardRoutes);
router.use("/discord", rbacAdmin, discordRoutes);
router.use("/teams", rbacAdmin, teamsRoutes);
router.use("/audit", rbacAdmin, auditRoutes);

// Role management routes (ADMIN only, enforced in roles.routes.js)
router.use("/admin/roles", requireAuth, requirePasswordCurrent, rolesRoutes);

module.exports = router;
