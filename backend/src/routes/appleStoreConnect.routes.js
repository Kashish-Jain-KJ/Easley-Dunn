/**
 * @file appleStoreConnect.routes.js
 * @description Routes for Apple Store Connect integration.
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { onboardAppleStoreConnectUser, offboardAppleStoreConnectUser } = require("../controllers/appleStoreConnect.controller");

const router = Router();

/**
 * @swagger
 * /appleStoreConnect/users/{userId}:
 *   post:
 *     summary: Onboard/invite user to Apple Store Connect
 *     tags: [AppleStoreConnect]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: The user's primary key (user_id)
 *     responses:
 *       201:
 *         description: Successfully sent Apple Store Connect invitation.
 *       400:
 *         description: Invalid input or user ID format.
 *       404:
 *         description: User not found in local database.
 *       500:
 *         description: Apple Store Connect API request failed or configuration is missing.
 */
router.post("/users/:userId", asyncHandler(onboardAppleStoreConnectUser));

/**
 * @swagger
 * /appleStoreConnect/users/{userId}:
 *   delete:
 *     summary: Delete/remove user from Apple Store Connect
 *     tags: [AppleStoreConnect]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: The user's primary key (user_id)
 *     responses:
 *       200:
 *         description: Successfully removed Apple Store Connect access.
 *       400:
 *         description: Invalid input or user ID format.
 *       404:
 *         description: Apple Store Connect access record not found or user not found on Apple servers.
 *       500:
 *         description: Apple Store Connect API request failed or configuration is missing.
 */
router.delete("/users/:userId", asyncHandler(offboardAppleStoreConnectUser));

module.exports = router;
