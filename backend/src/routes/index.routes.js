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

const requireAuth = require("../middlewares/requireAuth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");

const router = Router();

// Public routes
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
// Employee-facing Discord routes — no Cerberus session, ever. Must be mounted
// here, ahead of the gated /discord block below, so these match first.
router.use("/discord", discordPublicRoutes);

// Protected RBAC routes (Requires minimum OPERATOR role)
const rbacOperator = [requireAuth, requireRole("OPERATOR")];

router.use("/users", rbacOperator, usersRoutes);
router.use("/services", rbacOperator, servicesRoutes);
router.use("/google-play", rbacOperator, googlePlayRoutes);
router.use("/bigquery", rbacOperator, bigQueryRoutes);
router.use("/google-drive", rbacOperator, googleDriveRoutes);
router.use("/google-analytics", rbacOperator, googleAnalyticsRoutes);
router.use(["/appleStoreConnect", "/appleStoreConnet"], rbacOperator, appleStoreConnectRoutes);
router.use("/google-cloud", rbacOperator, googleCloudRoutes);
router.use("/firebase", rbacOperator, firebaseRoutes);
router.use("/kanboard", rbacOperator, kanboardRoutes);
router.use("/discord", rbacOperator, discordRoutes);

// Role delegation routes (Requires minimum MANAGER role)
router.use("/admin/roles", rolesRoutes);

module.exports = router;
