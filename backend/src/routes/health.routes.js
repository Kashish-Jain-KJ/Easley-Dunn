/**
 * @file health.routes.js
 * @description Health-check endpoint — used by load-balancers, Docker, and CI pipelines.
 *
 * GET /health    → quick liveness probe
 * GET /health/db → verifies live DB connectivity
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { getPool } = require("../db/database");

const router = Router();

// Liveness probe — no DB required
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      message: "Server is running",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  })
);

// Readiness probe — confirms DB pool is working
router.get(
  "/db",
  asyncHandler(async (_req, res) => {
    const [rows] = await getPool().query("SELECT 1 AS ok");
    res.json({
      success: true,
      database: rows[0].ok === 1 ? "connected" : "error",
      timestamp: new Date().toISOString(),
    });
  })
);

module.exports = router;
