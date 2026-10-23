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
  resendInvite,
  mailStatus,
  createSystemUser,
  getUserAccess,
  onboardUserAccess,
  offboardUserAccess,
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
 *                       Role: { type: string, example: "USER" }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden (Requires ADMIN role)
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
 *                     Role: { type: string, example: "USER" }
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
/**
 * @swagger
 * /users/mail-status:
 *   get:
 *     summary: Whether an invite could be emailed right now
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: "{ ok, reason }" }
 */
router.get("/mail-status", asyncHandler(mailStatus));

/**
 * @swagger
 * /users/{userId}/invite:
 *   post:
 *     summary: Send a fresh invite, retiring any earlier link
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Invite sent, or the link to pass on if mail failed. }
 *       404: { description: No such person. }
 *       409: { description: Inactive, or they already have a password. }
 */
router.post("/:userId/invite", asyncHandler(resendInvite));

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


module.exports = router;

