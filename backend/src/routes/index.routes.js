/**
 * @file index.routes.js
 * @description Root router — mounts all feature routers under the API prefix.
 *
 * Add new feature routers here as the project grows.
 */

"use strict";

const { Router } = require("express");
const healthRoutes = require("./health.routes");
const usersRoutes = require("./users.routes");
const servicesRoutes = require("./services.routes");
const commandRunsRoutes = require("./commandRuns.routes");
const googlePlayRoutes = require("./googlePlay.routes");
const bigQueryRoutes = require("./bigQuery.routes");

const router = Router();

router.use("/health", healthRoutes);
router.use("/users", usersRoutes);
router.use("/services", servicesRoutes);
router.use("/command-runs", commandRunsRoutes);
router.use("/google-play", googlePlayRoutes);
router.use("/bigquery", bigQueryRoutes);

module.exports = router;
