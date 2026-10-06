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

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Server liveness probe
 *     description: Quick health check verifying the server is running without hitting the database. Used by load-balancers and Docker health checks.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is online and responding.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Server is running" }
 *                 timestamp: { type: string, example: "2026-10-07T01:00:00.000Z" }
 *                 environment: { type: string, example: "development" }
 */
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

/**
 * @swagger
 * /health/db:
 *   get:
 *     summary: Database connectivity readiness probe
 *     description: Verifies active database connection pool health with a lightweight SELECT query.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database connectivity probe completed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 database: { type: string, example: "connected" }
 *                 timestamp: { type: string, example: "2026-10-07T01:00:00.000Z" }
 */
router.get(
  "/db",
  asyncHandler(async (_req, res) => {
    const { rows } = await getPool().query("SELECT 1 AS ok");
    res.json({
      success: true,
      database: rows[0].ok === 1 ? "connected" : "error",
      timestamp: new Date().toISOString(),
    });
  })
);

module.exports = router;

