/**
 * @file services.routes.js
 * @description Routes for the /services resource.
 *
 * GET /services → list all services
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { getAllServices } = require("../controllers/services.controller");

const router = Router();

/**
 * @swagger
 * /services:
 *   get:
 *     summary: List all services
 *     tags: [Services]
 *     responses:
 *       200:
 *         description: A list of all services in the database.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       service_id: { type: integer }
 *                       service_name: { type: string }
 *                       service_code: { type: string }
 *                       is_active: { type: boolean }
 */
router.get("/", asyncHandler(getAllServices));

module.exports = router;
