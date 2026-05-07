/**
 * @file bigQuery.routes.js
 * @description Routes for the /bigquery resource.
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { removeBigQueryUser } = require("../controllers/bigQuery.controller");

const router = Router();

/**
 * @swagger
 * /bigquery/users/{userId}:
 *   delete:
 *     summary: Delete user access from BigQuery
 *     tags: [BigQuery]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: The user's primary key (user_id)
 *     responses:
 *       200:
 *         description: Successfully processed BigQuery removal.
 *       400:
 *         description: Missing required identifiers in the database.
 *       404:
 *         description: BigQuery access record not found for this user.
 *       500:
 *         description: BigQuery API request failed or credentials file is missing.
 */
router.delete("/users/:userId", asyncHandler(removeBigQueryUser));

module.exports = router;
