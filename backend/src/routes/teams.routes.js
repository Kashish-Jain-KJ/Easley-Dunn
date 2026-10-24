/**
 * @file teams.routes.js
 * @description Teams and team members. Mounted behind requireAuth,
 * requirePasswordCurrent and requireRole("ADMIN") in index.routes.js.
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  archiveTeam,
  addMember,
  setLead,
  removeMember,
} = require("../controllers/teams.controller");

const router = Router();

/**
 * @swagger
 * /teams:
 *   get:
 *     summary: List teams with member count and leads
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Teams returned. Active teams first. }
 *   post:
 *     summary: Create a team
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Game Studio" }
 *               description: { type: string, example: "Unity mobile games" }
 *     responses:
 *       201: { description: Team created. }
 *       400: { description: Name missing or too long. }
 *       409: { description: An active team with this name already exists. }
 */
router.get("/", asyncHandler(listTeams));
router.post("/", asyncHandler(createTeam));

/**
 * @swagger
 * /teams/{teamId}:
 *   get:
 *     summary: Team detail with members
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: teamId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Team returned. }
 *       404: { description: Team not found. }
 *   patch:
 *     summary: Rename a team or change its description
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: teamId, required: true, schema: { type: integer } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200: { description: Team updated. }
 *       404: { description: Team not found. }
 *       409: { description: Team archived, or the new name is taken. }
 */
router.get("/:teamId", asyncHandler(getTeam));
router.patch("/:teamId", asyncHandler(updateTeam));

/**
 * @swagger
 * /teams/{teamId}/archive:
 *   post:
 *     summary: Archive a team (removes its members)
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: teamId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Team archived. }
 *       404: { description: Team not found. }
 *       409: { description: Team already archived. }
 */
router.post("/:teamId/archive", asyncHandler(archiveTeam));

/**
 * @swagger
 * /teams/{teamId}/members:
 *   post:
 *     summary: Add a member, optionally as lead
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: teamId, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: integer, example: 10 }
 *               isLead: { type: boolean, example: false }
 *     responses:
 *       201: { description: Member added. }
 *       404: { description: Team or user not found. }
 *       409: { description: Team archived; user inactive, admin, already a member; or can't lead (role isn't LEAD, or already leads another team). }
 */
router.post("/:teamId/members", asyncHandler(addMember));

/**
 * @swagger
 * /teams/{teamId}/members/{userId}:
 *   patch:
 *     summary: Make a member lead, or remove their lead flag
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: teamId, required: true, schema: { type: integer } }
 *       - { in: path, name: userId, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isLead]
 *             properties:
 *               isLead: { type: boolean }
 *     responses:
 *       200: { description: Lead flag updated. }
 *       404: { description: Team not found, or user is not a member. }
 *       409: { description: Already in that state, role isn't LEAD, or already leads another team. }
 *   delete:
 *     summary: Remove a member from a team
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: teamId, required: true, schema: { type: integer } }
 *       - { in: path, name: userId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Member removed. }
 *       404: { description: Team not found, or user is not a member. }
 *       409: { description: Team archived. }
 */
router.patch("/:teamId/members/:userId", asyncHandler(setLead));
router.delete("/:teamId/members/:userId", asyncHandler(removeMember));

module.exports = router;
