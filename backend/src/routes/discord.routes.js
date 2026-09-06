/**
 * @file discord.routes.js
 * @description Routes for the /discord resource integrations.
 *
 * POST   /discord/users/:userId              → generate + email a one-time server invite
 * DELETE /discord/users/:userId              → kick the user from the guild
 * POST   /discord/users/:userId/confirm      → resolve a self-reported Discord username to a
 *                                               real user ID and record it on the access row
 * GET    /discord/users/:userId/confirm-page → plain HTML form that POSTs to /confirm above
 * GET    /discord/users/:userId/status       → onboarded/confirmed status, read-only
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { onboardDiscordUser, removeDiscordUser, confirmDiscordUsername, renderConfirmPage, getDiscordStatus } = require("../controllers/discord.controller");

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

/**
 * @swagger
 * /discord/users/{userId}/status:
 *   get:
 *     summary: Get a user's Discord onboarding/confirmation status
 *     description: >
 *       Read-only. Reports whether the user currently has an active Discord
 *       access row (onboarded) and whether they've completed the confirm-page
 *       step (confirmed) — i.e. whether external_user_identifier is set, which
 *       is required before offboarding can kick them.
 *     tags: [Discord]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Status returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 userId: { type: integer }
 *                 onboarded: { type: boolean, description: "Has an active Discord access row" }
 *                 confirmed: { type: boolean, description: "external_user_identifier is set" }
 *                 discordUserId: { type: string, nullable: true }
 *       400:
 *         description: Invalid userId
 */
router.get("/users/:userId/status", asyncHandler(getDiscordStatus));

module.exports = router;
