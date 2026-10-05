/**
 * @file logUtils.js
 * @description Central helper functions for logging system onboarding/offboarding audit activities.
 */

"use strict";

const { getPool } = require("../db/database");

/**
 * Inserts a record into the `log` audit table.
 * @param {Object} params
 * @param {number|string} params.userId
 * @param {number|string|null} [params.serviceId]
 * @param {string} params.commandType - 'ONBOARD' | 'OFFBOARD'
 * @param {string} params.status - 'SUCCESS' | 'FAILED'
 * @param {string|null} [params.errorMessage]
 * @param {string|null} [params.performedBy]
 */
async function logActivity({ userId, serviceId = null, commandType, status, errorMessage = null, performedBy = null }) {
  try {
    const pool = getPool();
    await pool.query(`ALTER TABLE log ADD COLUMN IF NOT EXISTS performed_by VARCHAR(255);`);
    await pool.query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, performed_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [userId, serviceId || null, commandType, status, errorMessage || null, performedBy || null]
    );
  } catch (err) {
    console.error("Failed to insert audit log entry:", err.message);
  }
}

module.exports = {
  logActivity,
};
