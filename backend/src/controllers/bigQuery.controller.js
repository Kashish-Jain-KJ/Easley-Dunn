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

  try {
    // 1. Fetch the user's BigQuery access record from the database
    const { rows: accessRows } = await getPool().query(
      `SELECT usa.external_account_identifier, usa.external_user_identifier, usa.role_name
       FROM user_service_access usa
       JOIN services s ON usa.service_id = s.service_id
       WHERE usa.user_id = $1 AND s.service_code = 'BIG_QUERY'`,
      [userId]
    );

    if (accessRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `BigQuery access record not found for user_id '${userId}'.`,
      });
    }

    const { external_account_identifier, external_user_identifier, role_name } = accessRows[0];

    if (!external_account_identifier || !external_user_identifier) {
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

    console.log(`[BigQuery/IAM] Successfully removed ${external_user_identifier} from ${external_account_identifier}.`);
    
    res.json({
      success: true,
      message: `Successfully removed ${external_user_identifier} from BigQuery project ${external_account_identifier}.`,
    });
  } catch (error) {
    console.error("BigQuery API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove user via BigQuery API.",
      error: error.message,
    });
  }
}

module.exports = { removeBigQueryUser, getCloudResourceManagerClient };
