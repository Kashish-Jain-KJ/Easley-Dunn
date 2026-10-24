/**
 * @file user.routes.js
 * @description The signed-in person's own data. Mounted behind requireAuth and
 * requirePasswordCurrent in index.routes.js — and deliberately not behind
 * requireRole, because every role has access and teams of their own.
 *
 * Singular /user, unlike the admin's /users/:userId. See user.controller.js.
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { getOwnAccess, getOwnTeams, getOwnActivity } = require("../controllers/user.controller");

const router = Router();

/**
 * @swagger
 * /user/access:
 *   get:
 *     summary: The services the signed-in user currently holds
 *     description: Scoped to the session user. There is no id parameter.
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Access returned. An empty list means none yet.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count: { type: integer, example: 2 }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       access_id: { type: integer }
 *                       role_name: { type: string, example: "reader" }
 *                       external_account_identifier: { type: string }
 *                       external_user_identifier: { type: string }
 *                       last_synced_at: { type: string, format: date-time }
 *                       is_active: { type: boolean }
 *                       grantedAt: { type: string, format: date-time, nullable: true, description: "From the audit log; null for access granted before it existed." }
 *                       grantedBy: { type: string, nullable: true }
 *                       service:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           service_id: { type: integer }
 *                           service_name: { type: string, example: "Google Drive" }
 *                           service_code: { type: string, example: "GDRIVE" }
 *                           is_active: { type: boolean }
 *       401: { description: Not authenticated. }
 *       403: { description: A password change is outstanding. }
 */
router.get("/access", asyncHandler(getOwnAccess));

/**
 * @swagger
 * /user/team:
 *   get:
 *     summary: The teams the signed-in user belongs to, with their members
 *     description: Active teams only. Scoped to the session user.
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Teams returned. An empty list means no team yet.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count: { type: integer, example: 1 }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       team_id: { type: integer }
 *                       name: { type: string, example: "Web Platform" }
 *                       description: { type: string, nullable: true }
 *                       viewer_is_lead: { type: boolean }
 *                       member_count: { type: integer }
 *                       members:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             userId: { type: integer }
 *                             email: { type: string }
 *                             name: { type: string }
 *                             isLead: { type: boolean }
 *       401: { description: Not authenticated. }
 *       403: { description: A password change is outstanding. }
 */
router.get("/team", asyncHandler(getOwnTeams));

/**
 * @swagger
 * /user/activity:
 *   get:
 *     summary: The signed-in user's own history
 *     description: >
 *       Events where they are the actor or the subject, newest first. The audit
 *       record's `detail` is never returned here: it holds IP addresses, user
 *       agents and sign-in failure reasons, which belong to the admin log only.
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: before, schema: { type: string }, description: "Cursor from a previous page: \"<iso>|<event_id>\"" }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *       - { in: query, name: category, schema: { type: string, enum: [ACCESS, MEMBERSHIP, TEAMS, PEOPLE, AUTH] }, description: "Only this kind of event. AUTH is the sign-in history." }
 *     responses:
 *       200:
 *         description: A page of events, with a cursor when more remain.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count: { type: integer, example: 12 }
 *                 nextCursor: { type: string, nullable: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       eventId: { type: integer }
 *                       action: { type: string, example: "SERVICE_GRANTED" }
 *                       category: { type: string, example: "ACCESS" }
 *                       outcome: { type: string, example: "SUCCESS" }
 *                       createdAt: { type: string, format: date-time }
 *                       actorName: { type: string, nullable: true }
 *                       team:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           name: { type: string }
 *                       service:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           name: { type: string }
 *                       byMe: { type: boolean }
 *       401: { description: Not authenticated. }
 *       403: { description: A password change is outstanding. }
 */
router.get("/activity", asyncHandler(getOwnActivity));

module.exports = router;
