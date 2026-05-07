/**
 * @file users.routes.js
 * @description Routes for the /users resource.
 *
 * GET /users                → list all users
 * GET /users/:userId/access → get access info for a user
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { getUsers, getUserAccess } = require("../controllers/users.controller");

const router = Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: A list of users.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count:   { type: integer, example: 3 }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id:           { type: integer }
 *                       name:              { type: string }
 *                       email:             { type: string }
 *                       employment_status: { type: string }
 *                       start_date:        { type: string, format: date-time }
 */
router.get("/", asyncHandler(getUsers));

/**
 * @swagger
 * /users/{userId}/access:
 *   get:
 *     summary: Get access records for a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: The user's primary key (user_id)
 *     responses:
 *       200:
 *         description: Access records for the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 userId:  { type: string }
 *                 count:   { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       access_id:                   { type: integer }
 *                       user_id:                     { type: integer }
 *                       service_id:                  { type: integer }
 *                       external_account_identifier: { type: string }
 *                       external_user_identifier:    { type: string }
 *                       role_name:                   { type: string, nullable: true }
 *                       is_active:                   { type: boolean, nullable: true }
 *                       last_synced_at:              { type: string, format: date-time, nullable: true }
 *       404:
 *         description: User not found.
 */
router.get("/:userId/access", asyncHandler(getUserAccess));

module.exports = router;
