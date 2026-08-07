"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { onboardKanboardUser, offboardKanboardUser } = require("../controllers/kanboard.controller");

const router = Router();

/**
 * @swagger
 * /kanboard/users/{userId}:
 *   post:
 *     summary: Onboard a user to Kanboard
 *     tags: [Kanboard]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Successfully onboarded the user to Kanboard
 *       400:
 *         description: Invalid userId or missing required input
 *       404:
 *         description: User or access record not found
 *       500:
 *         description: Kanboard API request failed
 */
router.post("/users/:userId", asyncHandler(onboardKanboardUser));

/**
 * @swagger
 * /kanboard/users/{userId}:
 *   delete:
 *     summary: Offboard a user from Kanboard
 *     tags: [Kanboard]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Successfully removed the user from Kanboard
 *       400:
 *         description: Invalid userId or missing required input
 *       404:
 *         description: Access record not found
 *       500:
 *         description: Kanboard API request failed
 */
router.delete("/users/:userId", asyncHandler(offboardKanboardUser));

module.exports = router;
