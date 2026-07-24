/**
 * @file googleCloud.routes.js
 * @description Express routes for Google Cloud IAM integrations.
 *
 * POST   /google-cloud/users/:userId → onboard a user to a Google Cloud project
 * DELETE /google-cloud/users/:userId → offboard a user from a Google Cloud project
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { onboardGoogleCloudUser, removeGoogleCloudUser } = require("../controllers/googleCloud.controller");

const router = Router();

/**
 * @swagger
 * /google-cloud/users/{userId}:
 *   post:
 *     summary: Onboard a user to a Google Cloud project
 *     tags: [Google Cloud]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully onboarded user to Google Cloud project
 *       400:
 *         description: Missing required identifiers in database
 *       404:
 *         description: User or access record not found
 *       500:
 *         description: Google Cloud API request failed
 */
router.post("/users/:userId", asyncHandler(onboardGoogleCloudUser));

/**
 * @swagger
 * /google-cloud/users/{userId}:
 *   delete:
 *     summary: Remove a user's access from a Google Cloud project
 *     tags: [Google Cloud]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully removed user from Google Cloud project
 *       400:
 *         description: Missing required identifiers in database
 *       404:
 *         description: Access record or user/role not found in IAM policy
 *       500:
 *         description: Google Cloud API request failed
 */
router.delete("/users/:userId", asyncHandler(removeGoogleCloudUser));

module.exports = router;
