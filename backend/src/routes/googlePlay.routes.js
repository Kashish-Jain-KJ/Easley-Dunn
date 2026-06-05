/**
 * @file googlePlay.routes.js
 * @description Routes for the /google-play resource integrations.
 *
 * DELETE /google-play/users/:userId → delete a user from Google Play Developer Console
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { removeGooglePlayUser, listGooglePlayUsers, onboardGooglePlayUser } = require("../controllers/googlePlay.controller");

const router = Router();

/**
 * @swagger
 * /google-play/users/{userId}:
 *   delete:
 *     summary: Delete user from Google Play Developer Console
 *     tags: [GooglePlay]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: The user's primary key (user_id)
 *     responses:
 *       200:
 *         description: Successfully removed the user.
 *       400:
 *         description: Missing required identifiers in the database.
 *       404:
 *         description: Google Play access record not found for this user.
 *       500:
 *         description: Google Play API request failed or credentials file is missing.
 */
router.delete("/users/:userId", asyncHandler(removeGooglePlayUser));

/**
 * @swagger
 * /google-play/users/{userId}:
 *   post:
 *     summary: Onboard a user to Google Play Developer Console
 *     tags: [GooglePlay]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: The user's primary key from the local users table
 *     responses:
 *       201:
 *         description: Successfully onboarded the user.
 *       400:
 *         description: Invalid input or missing fields.
 *       404:
 *         description: User not found in local database.
 *       500:
 *         description: Google Play API request failed or credentials file is missing.
 */
router.post("/users/:userId", asyncHandler(onboardGooglePlayUser));

/*
 * @swagger
 * /google-play/developers/{developerId}/users:
 *   get:
 *     summary: List all users from Google Play Developer Console
 *     tags: [GooglePlay]
 *     parameters:
 *       - in: path
 *         name: developerId
 *         required: true
 *         schema: { type: string }
 *         description: The developer account ID (external_account_identifier)
 *     responses:
 *       200:
 *         description: Successfully fetched the users list.
 *       500:
 *         description: Google Play API request failed or credentials file is missing.
 */
// router.get("/developers/:developerId/users", asyncHandler(listGooglePlayUsers));

module.exports = router;
