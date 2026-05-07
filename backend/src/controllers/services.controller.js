/**
 * @file services.controller.js
 * @description Request handlers for the /services resource.
 *
 * GET /services/:serviceId/commands  → list all commands for a service
 */

"use strict";

const { getPool } = require("../db/database");

/**
 * GET /services/:serviceId/commands
 * Returns all commands belonging to the specified service.
 */
async function getServiceCommands(req, res) {
  const { serviceId } = req.params;

  const { rows: serviceRows } = await getPool().query(
    "SELECT service_id FROM services WHERE service_id = $1",
    [serviceId]
  );

  if (serviceRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `Service with id '${serviceId}' not found.`,
    });
  }

  const { rows: commandRows } = await getPool().query(
    "SELECT * FROM command_service_mapping WHERE service_id = $1 ORDER BY service_id ASC",
    [serviceId]
  );

  res.json({
    success: true,
    serviceId,
    count: commandRows.length,
    data: commandRows,
  });
}

module.exports = { getServiceCommands };
