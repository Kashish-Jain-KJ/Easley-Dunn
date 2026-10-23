/**
 * @file audit.routes.js
 * @description The audit log. Mounted behind requireAuth, requirePasswordCurrent
 * and requireRole("ADMIN") in index.routes.js.
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { listAudit, listActions } = require("../controllers/audit.controller");

const router = Router();

/**
 * @swagger
 * /audit:
 *   get:
 *     summary: Read the audit log, newest first
 *     description: >
 *       Paged by cursor, not by page number: the log is append-only, so an
 *       offset would shift rows between pages as new events arrive. Pass the
 *       `nextCursor` from a response as `before` to get the next page.
 *     tags: [Audit]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: since, schema: { type: string, format: date-time } }
 *       - { in: query, name: actorUserId, schema: { type: integer } }
 *       - { in: query, name: targetUserId, schema: { type: integer } }
 *       - { in: query, name: teamId, schema: { type: integer } }
 *       - { in: query, name: serviceId, schema: { type: integer } }
 *       - { in: query, name: action, schema: { type: string } }
 *       - { in: query, name: outcome, schema: { type: string, enum: [SUCCESS, FAILED] } }
 *       - { in: query, name: before, schema: { type: string }, description: cursor from nextCursor }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *     responses:
 *       200: { description: A page of events plus nextCursor (null on the last page). }
 */
router.get("/", asyncHandler(listAudit));

/**
 * @swagger
 * /audit/actions:
 *   get:
 *     summary: The action names present in the log, for the filter
 *     tags: [Audit]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Action names. }
 */
router.get("/actions", asyncHandler(listActions));

module.exports = router;
