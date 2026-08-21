/**
 * @file discord.routes.js
 * @description Routes for the /discord resource integrations.
 *
 * POST   /discord/users/:userId              → generate + email a one-time server invite
 * DELETE /discord/users/:userId              → kick the user from the guild
 * POST   /discord/users/:userId/confirm      → resolve a self-reported Discord username to a
 *                                               real user ID and record it on the access row
 * GET    /discord/users/:userId/confirm-page → plain HTML form that POSTs to /confirm above
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { onboardDiscordUser, removeDiscordUser, confirmDiscordUsername, renderConfirmPage } = require("../controllers/discord.controller");

const router = Router();

/**
 * @swagger
 * /discord/users/{userId}:
 *   post:
 *     summary: Generate and email a one-time Discord server invite
 *     tags: [Discord]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Successfully generated and sent a Discord invite
 *       400:
 *         description: Invalid userId or missing required input
 *       404:
 *         description: User or access record not found
 *       500:
 *         description: Discord API request failed or credentials not configured
 */
router.post("/users/:userId", asyncHandler(onboardDiscordUser));

/**
 * @swagger
 * /discord/users/{userId}:
 *   delete:
 *     summary: Kick a user from the mapped Discord guild
 *     tags: [Discord]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Successfully kicked the user from Discord
 *       400:
 *         description: Missing required identifiers in database
 *       404:
 *         description: Active access record not found
 *       500:
 *         description: Discord API request failed
 */
router.delete("/users/:userId", asyncHandler(removeDiscordUser));

// Intentionally undocumented in Swagger — internal-use links only (sent via
// the invite email), not meant to be called directly by API clients.
// Routes still fully functional, just not listed at /docs.
router.post("/users/:userId/confirm", asyncHandler(confirmDiscordUsername));
router.get("/users/:userId/confirm-page", asyncHandler(renderConfirmPage));

module.exports = router;
