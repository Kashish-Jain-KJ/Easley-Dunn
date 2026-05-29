/**
 * @file googleAnalytics.routes.js
 * @description Routes for the /google-analytics resource integrations.
 *
 * GET /google-analytics/access-bindings → list Google Analytics access bindings
 * DELETE /google-analytics/users/:userId → remove a user from Google Analytics
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  removeGoogleAnalyticsUser,
  listGoogleAnalyticsAccessBindings,
} = require("../controllers/googleAnalytics.controller");

const router = Router();

// /**
//  * @swagger
//  * /google-analytics/access-bindings:
//  *   get:
//  *     summary: List Google Analytics access bindings
//  *     tags: [GoogleAnalytics]
//  *     parameters:
//  *       - in: query
//  *         name: parent
//  *         required: false
//  *         schema: { type: string }
//  *         example: accounts/393345678
//  *         description: Optional Google Analytics parent resource, such as accounts/393345678 or properties/123456789
//  *     responses:
//  *       200:
//  *         description: Successfully fetched Google Analytics access bindings.
//  *       400:
//  *         description: Invalid parent resource.
//  *       500:
//  *         description: Google Analytics API request failed or credentials file is missing.
//  */
// router.get(
//   "/access-bindings",
//   asyncHandler(listGoogleAnalyticsAccessBindings)
// );

/**
 * @swagger
 * /google-analytics/users/{userId}:
 *   delete:
 *     summary: Remove user from Google Analytics
 *     tags: [GoogleAnalytics]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: The user's primary key from the local users table
 *     responses:
 *       200:
 *         description: Successfully removed the user's Google Analytics access.
 *       400:
 *         description: Invalid userId or missing required identifiers.
 *       404:
 *         description: Google Analytics service row not found.
 *       500:
 *         description: Google Analytics API request failed or credentials file is missing.
 */
router.delete(
  "/users/:userId",
  asyncHandler(removeGoogleAnalyticsUser)
);

module.exports = router;