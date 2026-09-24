/**
 * @file services.controller.js
 * @description Request handlers for the /services resource.
 *
 * GET /services → list all services
 */

"use strict";

const { getPool } = require("../db/database");

/**
 * GET /services
 * Returns all services in the database.
 */
async function getAllServices(_req, res) {
  const { rows } = await getPool().query(
    "SELECT * FROM services ORDER BY service_id ASC"
  );

  res.json({
    success: true,
    count: rows.length,
    data: rows,
  });
}

module.exports = { getAllServices };
