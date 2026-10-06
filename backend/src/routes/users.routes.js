/**
 * @file users.routes.js
 * @description Routes for the /users resource (Tracked System Employees).
 *
 * GET  /users                → list all users
 * POST /users                → add a new tracked system user/employee
 * GET  /users/:userId/access → get access info for a user
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  getUsers,
  createSystemUser,
  getUserAccess,
  onboardUserAccess,
  offboardUserAccess,
  getUserLogs,
} = require("../controllers/users.controller");

const router = Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all tracked employees
 *     description: Returns all tracked employees from the users table.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of tracked users returned.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count: { type: integer, example: 5 }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer, example: 1 }
 *                       user_id: { type: integer, example: 1 }
 *                       first_name: { type: string, example: "John" }
 *                       last_name: { type: string, example: "Doe" }
 *                       name: { type: string, example: "John Doe" }
 *                       email: { type: string, example: "john.doe@company.com" }
 *                       is_active: { type: boolean, example: true }
 *                       Role: { type: string, example: "MEMBER" }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden (Requires OPERATOR role)
 */
router.get("/", asyncHandler(getUsers));

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Add a new tracked employee
 *     description: Registers a new system user / employee to be tracked for onboarding and offboarding workflows.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: "John"
 *               last_name:
 *                 type: string
 *                 example: "Doe"
 *               name:
 *                 type: string
 *                 description: "Full name (alternative if first_name / last_name not provided)"
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@company.com"
 *     responses:
 *       201:
 *         description: User registered successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Registered system user 'John Doe' (john.doe@company.com) successfully." }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer, example: 12 }
 *                     user_id: { type: integer, example: 12 }
 *                     first_name: { type: string, example: "John" }
 *                     last_name: { type: string, example: "Doe" }
 *                     name: { type: string, example: "John Doe" }
 *                     email: { type: string, example: "john.doe@company.com" }
 *                     is_active: { type: boolean, example: true }
 *                     Role: { type: string, example: "MEMBER" }
 *       400:
 *         description: Email is missing or user with email already exists
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
router.post("/", asyncHandler(createSystemUser));

/**
 * @swagger
 * /users/{userId}/access:
 *   get:
 *     summary: Get service access records for an employee
 *     description: Returns third-party service access records (active or configured) for the specified user.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID
 *     responses:
 *       200:
 *         description: Service access list returned.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 userId: { type: string, example: "1" }
 *                 count: { type: integer, example: 3 }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       access_id: { type: integer }
 *                       user_id: { type: integer }
 *                       external_account_identifier: { type: string, nullable: true }
 *                       external_user_identifier: { type: string, nullable: true }
 *                       role_name: { type: string, nullable: true }
 *                       is_active: { type: boolean }
 *                       last_synced_at: { type: string, nullable: true }
 *                       service:
 *                         type: object
 *                         properties:
 *                           service_id: { type: integer }
 *                           service_name: { type: string }
 *                           service_code: { type: string }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
router.get("/:userId/access", asyncHandler(getUserAccess));

/**
 * @swagger
 * /users/{userId}/access/{accessId}/onboard:
 *   post:
 *     summary: Manually mark service access as onboarded
 *     description: Sets `is_active = true` on the specified `user_service_access` record and logs the activity.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID
 *       - in: path
 *         name: accessId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The access record ID
 *     responses:
 *       200:
 *         description: Successfully updated access record to active.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Successfully manually onboarded service 'Discord' for user_id '2'." }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Access record not found
 */
router.post("/:userId/access/:accessId/onboard", asyncHandler(onboardUserAccess));

/**
 * @swagger
 * /users/{userId}/access/{accessId}/offboard:
 *   post:
 *     summary: Manually mark service access as offboarded
 *     description: Sets `is_active = false` on the specified `user_service_access` record and logs the activity.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID
 *       - in: path
 *         name: accessId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The access record ID
 *     responses:
 *       200:
 *         description: Successfully updated access record to inactive.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Successfully manually offboarded service 'Discord' for user_id '2'." }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Access record not found
 */
router.post("/:userId/access/:accessId/offboard", asyncHandler(offboardUserAccess));

/**
 * @swagger
 * /users/{userId}/logs:
 *   get:
 *     summary: Get audit activity logs for an employee
 *     description: Returns chronological audit logs of all ONBOARD / OFFBOARD commands and results for the user.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID
 *     responses:
 *       200:
 *         description: Activity log entries and summary stats.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 userId: { type: string, example: "4" }
 *                 count: { type: integer, example: 10 }
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total: { type: integer, example: 10 }
 *                     success: { type: integer, example: 8 }
 *                     failed: { type: integer, example: 2 }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer, example: 21 }
 *                       user_id: { type: integer, example: 4 }
 *                       service_id: { type: integer, example: 3 }
 *                       command_type: { type: string, example: "ONBOARD" }
 *                       status: { type: string, example: "SUCCESS" }
 *                       error_message: { type: string, nullable: true }
 *                       performed_by: { type: string, example: "Kashish Jain" }
 *                       created_at: { type: string, example: "2026-10-05T13:04:55.848Z" }
 *                       service_name: { type: string, example: "BigQuery" }
 *                       service_code: { type: string, example: "BIGQUERY" }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
router.get("/:userId/logs", asyncHandler(getUserLogs));

module.exports = router;

