/**
 * @file bigQuery.controller.js
 * @description Request handlers for BigQuery integrations.
 *
 * DELETE /bigquery/users/:userId → delete a user's access from BigQuery
 */

"use strict";

const { getPool } = require("../db/database");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

/**
 * Helper function to instantiate an authenticated Cloud Resource Manager client.
 */
async function getCloudResourceManagerClient() {
  const folderPath = path.join(__dirname, "../../bigquery_json");
  let keyFilePath = null;

  if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    const files = fs.readdirSync(folderPath);
    const jsonFile = files.find(f => f.endsWith(".json"));
    if (jsonFile) {
      keyFilePath = path.join(folderPath, jsonFile);
    }
  }

  if (!keyFilePath) {
    throw new Error("No .json credentials file found inside the bigquery_json folder.");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  return google.cloudresourcemanager({ version: "v3", auth });
}

/**
 * DELETE /bigquery/users/:userId
 * Deletes a user from BigQuery using the provided service account json.
 */
async function removeBigQueryUser(req, res) {
  const { userId } = req.params;

  let serviceIdVal = null;
  try {
    // 1. Fetch the user's BigQuery access record from the database
    const { rows: accessRows } = await getPool().query(
      `SELECT usa.external_account_identifier, usa.external_user_identifier, usa.role_name, usa.service_id
       FROM user_service_access usa
       JOIN services s ON usa.service_id = s.service_id
       WHERE usa.user_id = $1 AND s.service_code = 'BIG_QUERY'`,
      [userId]
    );

    if (accessRows.length === 0) {
      try {
        const { rows } = await getPool().query(
          "SELECT service_id FROM services WHERE service_code = 'BIG_QUERY'"
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }

      await getPool().query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
        [userId, serviceIdVal, `BigQuery access record not found for user_id '${userId}'. (Code: 404)`]
      );

      return res.status(404).json({
        success: false,
        message: `BigQuery access record not found for user_id '${userId}'.`,
      });
    }

    const { external_account_identifier, external_user_identifier, role_name, service_id } = accessRows[0];
    serviceIdVal = service_id;

    if (!external_account_identifier || !external_user_identifier) {
      await getPool().query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
        [userId, serviceIdVal, "Missing external_account_identifier or external_user_identifier in the database. (Code: 400)"]
      );

      return res.status(400).json({
        success: false,
        message: "Missing external_account_identifier (Project ID) or external_user_identifier (Email) in the database.",
      });
    }

    // 2. Authenticate with Google Cloud Resource Manager
    const crm = await getCloudResourceManagerClient();
    const resource = `projects/${external_account_identifier}`;

    // 3. Get current IAM policy
    const { data: policy } = await crm.projects.getIamPolicy({
      resource,
      requestBody: {},
    });

    const memberToRemove = `user:${external_user_identifier}`;
    let modified = false;
    const newBindings = [];

    // 4. Logic to filter out the user
    for (const binding of (policy.bindings || [])) {
      if (binding.members && binding.members.includes(memberToRemove)) {
        // If a specific role is provided, only remove them from that role
        if (role_name && binding.role !== role_name) {
          newBindings.push(binding);
          continue;
        }

        binding.members = binding.members.filter((m) => m !== memberToRemove);
        modified = true;
      }

      // Only keep the binding if it still has members left
      if (binding.members && binding.members.length > 0) {
        newBindings.push(binding);
      }
    }

    if (!modified) {
      await getPool().query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
        [userId, serviceIdVal, `User/Role combination not found in IAM policy for project ${external_account_identifier}. (Code: 404)`]
      );

      return res.status(404).json({
        success: false,
        message: `User/Role combination not found in IAM policy for project ${external_account_identifier}.`,
      });
    }

    policy.bindings = newBindings;

    // 5. Update the IAM policy
    await crm.projects.setIamPolicy({
      resource,
      requestBody: { policy },
    });

    // Update local DB status to inactive
    await getPool().query(
      `UPDATE user_service_access
       SET is_active = false
       WHERE user_id = $1 AND service_id = $2`,
      [userId, serviceIdVal]
    );

    // Insert success log
    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'OFFBOARD', 'SUCCESS', NULL, NOW())`,
      [userId, serviceIdVal]
    );

    console.log(`[BigQuery/IAM] Successfully removed ${external_user_identifier} from ${external_account_identifier}.`);
    
    res.json({
      success: true,
      message: `Successfully removed ${external_user_identifier} from BigQuery project ${external_account_identifier}.`,
    });
  } catch (error) {
    console.error("BigQuery API Error:", error);

    if (!serviceIdVal) {
      try {
        const { rows } = await getPool().query(
          "SELECT service_id FROM services WHERE service_code = 'BIG_QUERY'"
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }
    }

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    // Insert failure log
    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
      [userId, serviceIdVal, errMessage]
    );

    res.status(500).json({
      success: false,
      message: "Failed to remove user via BigQuery API.",
      error: errMessage,
    });
  }
}

module.exports = { removeBigQueryUser, getCloudResourceManagerClient };
