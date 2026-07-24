/**
 * @file googleCloud.controller.js
 * @description Request handlers for Google Cloud IAM integrations.
 *
 * POST   /google-cloud/users/:userId → onboard a user to a Google Cloud project
 * DELETE /google-cloud/users/:userId → offboard a user from a Google Cloud project
 */

"use strict";

const { getPool } = require("../db/database");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

async function getCloudResourceManagerClient() {
  const folderPath = path.join(__dirname, "../../googlecloud_json");
  let keyFilePath = null;

  if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    const files = fs.readdirSync(folderPath);
    const jsonFile = files.find(f => f.endsWith(".json"));
    if (jsonFile) {
      keyFilePath = path.join(folderPath, jsonFile);
    }
  }

  if (!keyFilePath) {
    throw new Error("No .json credentials file found inside the googlecloud_json folder.");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  return google.cloudresourcemanager({ version: "v3", auth });
}

function getGoogleCloudProjectId() {
  const folderPath = path.join(__dirname, "../../googlecloud_json");
  if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    const files = fs.readdirSync(folderPath);
    const jsonFile = files.find(f => f.endsWith(".json"));
    if (jsonFile) {
      const keyFilePath = path.join(folderPath, jsonFile);
      const content = fs.readFileSync(keyFilePath, "utf8");
      const key = JSON.parse(content);
      return key.project_id;
    }
  }
  return null;
}

async function removeGoogleCloudUser(req, res) {
  const { userId } = req.params;

  let serviceIdVal = null;
  try {
    const { rows: accessRows } = await getPool().query(
      `SELECT usa.external_account_identifier, usa.external_user_identifier, usa.role_name, usa.service_id
       FROM user_service_access usa
       JOIN services s ON usa.service_id = s.service_id
       WHERE usa.user_id = $1 AND s.service_code = 'GOOGLE_CLOUD'`,
      [userId]
    );

    if (accessRows.length === 0) {
      try {
        const { rows } = await getPool().query(
          "SELECT service_id FROM services WHERE service_code = 'GOOGLE_CLOUD'"
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }

      await getPool().query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
        [userId, serviceIdVal, `Google Cloud access record not found for user_id '${userId}'. (Code: 404)`]
      );

      return res.status(404).json({
        success: false,
        message: `Google Cloud access record not found for user_id '${userId}'.`,
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

    const crm = await getCloudResourceManagerClient();
    const resource = `projects/${external_account_identifier}`;

    const { data: policy } = await crm.projects.getIamPolicy({
      resource,
      requestBody: {},
    });

    const memberToRemove = `user:${external_user_identifier}`;
    let modified = false;
    const newBindings = [];

    for (const binding of (policy.bindings || [])) {
      if (binding.members && binding.members.includes(memberToRemove)) {
        if (role_name && binding.role !== role_name) {
          newBindings.push(binding);
          continue;
        }

        binding.members = binding.members.filter((m) => m !== memberToRemove);
        modified = true;
      }

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

    await crm.projects.setIamPolicy({
      resource,
      requestBody: { policy },
    });

    await getPool().query(
      `UPDATE user_service_access
       SET is_active = false
       WHERE user_id = $1 AND service_id = $2`,
      [userId, serviceIdVal]
    );

    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'OFFBOARD', 'SUCCESS', NULL, NOW())`,
      [userId, serviceIdVal]
    );

    console.log(`[Google Cloud/IAM] Successfully removed ${external_user_identifier} from ${external_account_identifier}.`);

    res.json({
      success: true,
      message: `Successfully removed ${external_user_identifier} from Google Cloud project ${external_account_identifier}.`,
    });
  } catch (error) {
    console.error("Google Cloud API Error:", error);

    if (!serviceIdVal) {
      try {
        const { rows } = await getPool().query(
          "SELECT service_id FROM services WHERE service_code = 'GOOGLE_CLOUD'"
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }
    }

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
      [userId, serviceIdVal, errMessage]
    );

    res.status(500).json({
      success: false,
      message: "Failed to remove user via Google Cloud API.",
      error: errMessage,
    });
  }
}

async function onboardGoogleCloudUser(req, res) {
  const { userId } = req.params;

  let serviceIdVal = null;
  try {
    let { rows: accessRows } = await getPool().query(
      `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier, usa.role_name, usa.service_id
       FROM user_service_access usa
       JOIN services s ON usa.service_id = s.service_id
       WHERE usa.user_id = $1 AND s.service_code = 'GOOGLE_CLOUD' AND usa.is_active = false`,
      [userId]
    );

    if (accessRows.length === 0) {
      try {
        const { rows } = await getPool().query(
          "SELECT service_id FROM services WHERE service_code = 'GOOGLE_CLOUD'"
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }

      const { rows: userRows } = await getPool().query(
        "SELECT email FROM users WHERE user_id = $1",
        [userId]
      );

      if (userRows.length === 0) {
        await getPool().query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
          [userId, serviceIdVal, `User not found with user_id '${userId}'.`]
        );
        return res.status(404).json({
          success: false,
          message: `User not found with user_id '${userId}'.`,
        });
      }

      const userEmail = userRows[0].email;
      const projectId = getGoogleCloudProjectId();

      if (!projectId) {
        await getPool().query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
          [userId, serviceIdVal, "Credentials file or project_id not found inside googlecloud_json folder."]
        );
        return res.status(500).json({
          success: false,
          message: "No credentials file or project_id found inside googlecloud_json folder.",
        });
      }

      const { rows: newAccessRows } = await getPool().query(
        `INSERT INTO user_service_access (user_id, service_id, external_account_identifier, external_user_identifier, is_active, last_synced_at)
         VALUES ($1, $2, $3, $4, false, NOW())
         RETURNING access_id, external_account_identifier, external_user_identifier, role_name, service_id`,
        [userId, serviceIdVal, projectId, userEmail]
      );

      accessRows = newAccessRows;
    }

    const crm = await getCloudResourceManagerClient();
    const results = [];

    for (const row of accessRows) {
      const { access_id, external_account_identifier, external_user_identifier, role_name, service_id } = row;
      serviceIdVal = service_id;

      if (!external_account_identifier || !external_user_identifier) {
        const errMessage = "Missing external_account_identifier or external_user_identifier in the database. (Code: 400)";
        await getPool().query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
          [userId, serviceIdVal, errMessage]
        );
        results.push({ access_id, status: "failed", error: "Missing Project ID or Email" });
        continue;
      }

      try {
        const resource = `projects/${external_account_identifier}`;

        const { data: policy } = await crm.projects.getIamPolicy({
          resource,
          requestBody: {},
        });

        const memberToAdd = `user:${external_user_identifier}`;
        const targetRole = role_name || "roles/viewer";

        if (!policy.bindings) {
          policy.bindings = [];
        }

        let binding = policy.bindings.find(b => b.role === targetRole);
        if (binding) {
          if (!binding.members) binding.members = [];
          if (!binding.members.includes(memberToAdd)) {
            binding.members.push(memberToAdd);
          }
        } else {
          policy.bindings.push({ role: targetRole, members: [memberToAdd] });
        }

        await crm.projects.setIamPolicy({
          resource,
          requestBody: { policy },
        });

        await getPool().query(
          `UPDATE user_service_access
           SET is_active = true, last_synced_at = NOW()
           WHERE access_id = $1`,
          [access_id]
        );

        await getPool().query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'ONBOARD', 'SUCCESS', NULL, NOW())`,
          [userId, serviceIdVal]
        );

        console.log(`[Google Cloud/IAM] Successfully added ${external_user_identifier} to ${external_account_identifier} with role ${targetRole}.`);
        results.push({ access_id, project: external_account_identifier, role: targetRole, status: "onboarded" });
      } catch (error) {
        console.error("Google Cloud API Error for row:", error);
        const errCode = error.code || error.status || "500";
        const errMessage = `${error.message} (Code: ${errCode})`;

        await getPool().query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
          [userId, serviceIdVal, errMessage]
        );

        results.push({ access_id, project: external_account_identifier, status: "failed", error: errMessage });
      }
    }

    const successCount = results.filter(r => r.status === "onboarded").length;
    if (successCount === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to onboard user to any Google Cloud projects.",
        data: results,
      });
    }

    res.json({
      success: true,
      message: `Successfully onboarded user to ${successCount} Google Cloud project(s).`,
      data: results,
    });
  } catch (error) {
    console.error("Google Cloud API Error overall:", error);

    if (!serviceIdVal) {
      try {
        const { rows } = await getPool().query(
          "SELECT service_id FROM services WHERE service_code = 'GOOGLE_CLOUD'"
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }
    }

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
      [userId, serviceIdVal, errMessage]
    );

    res.status(500).json({
      success: false,
      message: "Failed to onboard user via Google Cloud API.",
      error: errMessage,
    });
  }
}

module.exports = { removeGoogleCloudUser, onboardGoogleCloudUser, getCloudResourceManagerClient };
