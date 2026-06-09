/**
 * @file services.routes.js
 * @description Routes for the /services resource.
 *
 * GET /services/:serviceId/commands → list all commands for a service
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { getServiceCommands, getAllServices } = require("../controllers/services.controller");

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

/**
 * @swagger
 * /services/{serviceId}/commands:
 *   get:
 *     summary: List all commands for a service
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema: { type: integer }
 *         description: The service's primary key (service_id)
 *     responses:
 *       200:
 *         description: Commands belonging to the service.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:   { type: boolean, example: true }
 *                 serviceId: { type: string }
 *                 count:     { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Service not found.
 */
router.get("/:serviceId/commands", asyncHandler(getServiceCommands));

module.exports = router;
