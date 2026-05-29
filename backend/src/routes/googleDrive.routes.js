/**
 * @file googleDrive.routes.js
 * @description Express routes for Google Drive integrations.
 *
 * POST   /google-drive/users/:userId/onboard  → grant user access to Drive folders
 * DELETE /google-drive/users/:userId          → remove user access from Drive folders
 * GET    /google-drive/users/:userId/audit    → audit files still owned by the user
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  onboardGoogleDriveUser,
  offboardGoogleDriveUser,
  auditGoogleDriveOwnership,
} = require("../controllers/googleDrive.controller");

const router = Router();

// /**
//  * @swagger
//  * /google-drive/users/{userId}/onboard:
//  *   post:
//  *     summary: Grant a user access to their mapped Google Drive folders
//  *     tags: [Google Drive]
//  *     parameters:
//  *       - in: path
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *     responses:
//  *       200:
//  *         description: Onboarding complete
//  *       404:
//  *         description: No inactive access records found
//  */
// router.post("/users/:userId/onboard", asyncHandler(onboardGoogleDriveUser));

/**
 * @swagger
 * /google-drive/users/{userId}:
 *   delete:
 *     summary: Remove a user's access from all their mapped Google Drive folders
 *     tags: [Google Drive]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Offboarding complete
 *       404:
 *         description: No active access records found
 *       409:
 *         description: Blocked — user still owns files, ownership transfer required
 */
router.delete("/users/:userId", asyncHandler(offboardGoogleDriveUser));

// /**
//  * @swagger
//  * /google-drive/users/{userId}/audit:
//  *   get:
//  *     summary: Audit files and folders still owned by the user in Google Drive
//  *     tags: [Google Drive]
//  *     parameters:
//  *       - in: path
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: integer
//  *     responses:
//  *       200:
//  *         description: Audit results returned
//  *       404:
//  *         description: User not found
//  */
// router.get("/users/:userId/audit", asyncHandler(auditGoogleDriveOwnership));

module.exports = router;