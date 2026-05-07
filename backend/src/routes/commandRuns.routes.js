/**
 * @file commandRuns.routes.js
 * @description Routes for the /command-runs resource.
 *
 * POST /command-runs               → create a new command run
 * GET  /command-runs/:runId        → fetch a single command run
 * GET  /command-runs/:runId/steps  → fetch all steps for a run
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  createCommandRun,
  getCommandRun,
  getCommandRunSteps,
  updateCommandRun,
  createCommandRunStep,
  updateCommandRunStep,
} = require("../controllers/commandRuns.controller");

const router = Router();

/**
 * @swagger
 * /command-runs:
 *   post:
 *     summary: Create a new command run
 *     tags: [Command Runs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [command_name, user_id, service_id, triggered_by]
 *             properties:
 *               command_name:
 *                 type: string
 *                 description: Name of the command to run
 *               user_id:
 *                 type: integer
 *                 description: ID of the user triggering the run
 *               service_id:
 *                 type: integer
 *                 description: ID of the service the command belongs to
 *               triggered_by:
 *                 type: string
 *                 description: Identifier of who/what triggered the run
 *     responses:
 *       201:
 *         description: Command run created with status RUNNING.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 run_id:     { type: integer }
 *                 run_status: { type: string, example: RUNNING }
 *       400:
 *         description: Missing required fields.
 */
router.post("/", asyncHandler(createCommandRun));

/**
 * @swagger
 * /command-runs/{runId}:
 *   get:
 *     summary: Get a single command run
 *     tags: [Command Runs]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: integer }
 *         description: The command run's primary key
 *     responses:
 *       200:
 *         description: The command run record.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:    { type: object }
 *       404:
 *         description: Command run not found.
 */
router.get("/:runId", asyncHandler(getCommandRun));

/**
 * @swagger
 * /command-runs/{runId}/steps:
 *   get:
 *     summary: Get all steps for a command run
 *     tags: [Command Runs]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: integer }
 *         description: The command run's primary key
 *     responses:
 *       200:
 *         description: Steps for the command run, ordered by step_number.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 runId:   { type: string }
 *                 count:   { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       step_log_id:   { type: integer }
 *                       run_id:        { type: integer }
 *                       step_number:   { type: integer }
 *                       step_name:     { type: string }
 *                       status:        { type: string }
 *                       started_at:    { type: string, format: date-time, nullable: true }
 *                       ended_at:      { type: string, format: date-time, nullable: true }
 *                       error_message: { type: string, nullable: true }
 *       404:
 *         description: Command run not found.
 */
router.get("/:runId/steps", asyncHandler(getCommandRunSteps));

/**
 * @swagger
 * /command-runs/{runId}/steps:
 *   post:
 *     summary: Create a new step log for a command run
 *     tags: [Command Runs]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: integer }
 *         description: The command run's primary key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [step_number, step_name]
 *             properties:
 *               step_number:
 *                 type: integer
 *                 description: Order/sequence number of the step
 *               step_name:
 *                 type: string
 *                 description: Name or description of the step
 *     responses:
 *       201:
 *         description: Step log created with status PENDING.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 step_log_id: { type: integer }
 *                 step_number: { type: integer }
 *       400:
 *         description: Missing required fields.
 *       404:
 *         description: Command run not found.
 */
router.post("/:runId/steps", asyncHandler(createCommandRunStep));

/**
 * @swagger
 * /command-runs/{runId}:
 *   patch:
 *     summary: Partially update a command run
 *     tags: [Command Runs]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: integer }
 *         description: The command run's primary key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               run_status:     { type: string, example: COMPLETED }
 *               ended_at:       { type: string, format: date-time }
 *               failure_reason: { type: string, nullable: true }
 *               triggered_by:   { type: string }
 *               command_name:   { type: string }
 *               service_id:     { type: integer }
 *     responses:
 *       200:
 *         description: Updated command run record.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:    { type: object }
 *       400:
 *         description: No valid fields provided.
 *       404:
 *         description: Command run not found.
 */
router.patch("/:runId", asyncHandler(updateCommandRun));

/**
 * @swagger
 * /command-runs/{runId}/steps/{stepNumber}:
 *   patch:
 *     summary: Partially update a step log for a command run
 *     tags: [Command Runs]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: integer }
 *         description: The command run's primary key
 *       - in: path
 *         name: stepNumber
 *         required: true
 *         schema: { type: integer }
 *         description: The sequence number of the step
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:        { type: string, example: COMPLETED }
 *               ended_at:      { type: string, format: date-time }
 *               error_message: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Updated step log record.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:    { type: object }
 *       400:
 *         description: No valid fields provided.
 *       404:
 *         description: Step log not found.
 */
router.patch("/:runId/steps/:stepNumber", asyncHandler(updateCommandRunStep));

module.exports = router;
