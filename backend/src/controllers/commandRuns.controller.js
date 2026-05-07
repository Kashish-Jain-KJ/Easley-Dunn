/**
 * @file commandRuns.controller.js
 * @description Request handlers for the /command-runs resource.
 *
 * POST /command-runs               → create a new command run
 * GET  /command-runs/:runId        → fetch a single command run
 * GET  /command-runs/:runId/steps  → fetch all steps for a run
 */

"use strict";

const { getPool } = require("../db/database");

/**
 * POST /command-runs
 * Creates a new command run record.
 *
 * Expected body: { command_name, user_id, service_id, triggered_by }
 */
async function createCommandRun(req, res) {
  const { command_name, user_id, service_id, triggered_by } = req.body;

  if (!command_name || !user_id || !service_id || !triggered_by) {
    return res.status(400).json({
      success: false,
      message: "command_name, user_id, service_id, and triggered_by are all required.",
    });
  }

  const { rows: resultRows } = await getPool().query(
    `INSERT INTO command_run
       (command_name, user_id, service_id, run_status, triggered_by, started_at, ended_at, failure_reason)
     VALUES ($1, $2, $3, 'RUNNING', $4, NOW(), NULL, NULL) RETURNING run_id`,
    [command_name, user_id, service_id, triggered_by]
  );

  res.status(201).json({
    run_id: resultRows[0].run_id,
    run_status: "RUNNING",
  });
}

/**
 * GET /command-runs/:runId
 * Returns a single command run by its primary key.
 */
async function getCommandRun(req, res) {
  const { runId } = req.params;

  const { rows } = await getPool().query(
    "SELECT * FROM command_run WHERE run_id = $1",
    [runId]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `Command run with id '${runId}' not found.`,
    });
  }

  res.json({
    success: true,
    data: rows[0],
  });
}

/**
 * GET /command-runs/:runId/steps
 * Returns all steps associated with a command run, ordered by sequence.
 */
async function getCommandRunSteps(req, res) {
  const { runId } = req.params;

  const { rows: runRows } = await getPool().query(
    "SELECT run_id FROM command_run WHERE run_id = $1",
    [runId]
  );

  if (runRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `Command run with id '${runId}' not found.`,
    });
  }

  const { rows: stepRows } = await getPool().query(
    "SELECT * FROM command_step_log WHERE run_id = $1 ORDER BY step_number ASC",
    [runId]
  );

  res.json({
    success: true,
    runId,
    count: stepRows.length,
    data: stepRows,
  });
}

/**
 * PATCH /command-runs/:runId
 * Partially updates a command run — only the fields present in the request body are changed.
 *
 * Updatable fields: run_status, ended_at, failure_reason, triggered_by, command_name, service_id
 */
async function updateCommandRun(req, res) {
  const { runId } = req.params;

  // Whitelist of columns that are safe to update
  const ALLOWED_FIELDS = [
    "run_status",
    "ended_at",
    "failure_reason",
    "triggered_by",
    "command_name",
    "service_id",
  ];

  // Pick only the fields the caller actually sent
  const updates = {};
  for (const field of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: `No valid fields provided. Updatable fields: ${ALLOWED_FIELDS.join(", ")}.`,
    });
  }

  // Check the run exists
  const { rows: runRows } = await getPool().query(
    "SELECT run_id FROM command_run WHERE run_id = $1",
    [runId]
  );

  if (runRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `Command run with id '${runId}' not found.`,
    });
  }

  // Build dynamic SET clause.
  // ended_at is always set to NOW() (server time) — the passed value is ignored.
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const [field, value] of Object.entries(updates)) {
    if (field === "ended_at") {
      setClauses.push("ended_at = NOW()");
      // no value pushed — NOW() needs no bound parameter
    } else {
      setClauses.push(`${field} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  values.push(runId); // for the WHERE clause
  const whereClause = `run_id = $${paramIndex}`;

  await getPool().query(
    `UPDATE command_run SET ${setClauses.join(", ")} WHERE ${whereClause}`,
    values
  );

  // Return the updated row
  const { rows: updated } = await getPool().query(
    "SELECT * FROM command_run WHERE run_id = $1",
    [runId]
  );

  res.json({
    success: true,
    data: updated[0],
  });
}

/**
 * POST /command-runs/:runId/steps
 * Creates a new step log for a command run.
 */
async function createCommandRunStep(req, res) {
  const { runId } = req.params;
  const { step_number, step_name } = req.body;

  if (step_number == null || !step_name) {
    return res.status(400).json({
      success: false,
      message: "step_number and step_name are required.",
    });
  }

  // Check the run exists
  const { rows: runRows } = await getPool().query(
    "SELECT run_id FROM command_run WHERE run_id = $1",
    [runId]
  );

  if (runRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `Command run with id '${runId}' not found.`,
    });
  }

  const { rows: resultRows } = await getPool().query(
    `INSERT INTO command_step_log (
       run_id, step_number, step_name, status, started_at, ended_at, error_message
     ) VALUES ($1, $2, $3, 'RUNNING', NOW(), NULL, NULL) RETURNING step_log_id`,
    [runId, step_number, step_name]
  );

  res.status(201).json({
    step_log_id: resultRows[0].step_log_id,
    step_number: step_number,
  });
}

/**
 * PATCH /command-runs/:runId/steps/:stepNumber
 * Partially updates a command run step — only the fields present in the request body are changed.
 *
 * Updatable fields: status, ended_at, error_message
 */
async function updateCommandRunStep(req, res) {
  const { runId, stepNumber } = req.params;

  // Whitelist of columns that are safe to update
  const ALLOWED_FIELDS = [
    "status",
    "ended_at",
    "error_message",
  ];

  // Pick only the fields the caller actually sent
  const updates = {};
  for (const field of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: `No valid fields provided. Updatable fields: ${ALLOWED_FIELDS.join(", ")}.`,
    });
  }

  // Check the step exists
  const { rows: stepRows } = await getPool().query(
    "SELECT step_log_id FROM command_step_log WHERE run_id = $1 AND step_number = $2",
    [runId, stepNumber]
  );

  if (stepRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `Command run step with runId '${runId}' and stepNumber '${stepNumber}' not found.`,
    });
  }

  // Build dynamic SET clause.
  // ended_at is always set to NOW() (server time) — the passed value is ignored.
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const [field, value] of Object.entries(updates)) {
    if (field === "ended_at") {
      setClauses.push("ended_at = NOW()");
      // no value pushed — NOW() needs no bound parameter
    } else {
      setClauses.push(`${field} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  values.push(runId, stepNumber); // for the WHERE clause
  const whereClause = `run_id = $${paramIndex} AND step_number = $${paramIndex + 1}`;

  await getPool().query(
    `UPDATE command_step_log SET ${setClauses.join(", ")} WHERE ${whereClause}`,
    values
  );

  // Return the updated row
  const { rows: updated } = await getPool().query(
    "SELECT * FROM command_step_log WHERE run_id = $1 AND step_number = $2",
    [runId, stepNumber]
  );

  res.json({
    success: true,
    data: updated[0],
  });
}

module.exports = {
  createCommandRun,
  getCommandRun,
  getCommandRunSteps,
  updateCommandRun,
  createCommandRunStep,
  updateCommandRunStep,
};