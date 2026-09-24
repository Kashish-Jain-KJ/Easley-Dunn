/**
 * @file googlePlay.controller.js
 * @description Request handlers for Google Play Developer Console integrations.
 *
 * DELETE /google-play/users/:userId → delete a user from the Google Play Developer Console
 */

"use strict";

const { getPool } = require("../db/database");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const { logActivity } = require("../utils/logUtils");

/**
 * DELETE /google-play/users/:userId
 * Deletes a user from the Google Play Developer Console using the provided service account json.
 */
async function removeGooglePlayUser(req, res) {
  const { userId } = req.params;

  // 1. Fetch the user's Google Play access record from the database
  const { rows: accessRows } = await getPool().query(
    `SELECT usa.external_account_identifier, usa.external_user_identifier, usa.service_id
     FROM user_service_access usa
     JOIN services s ON usa.service_id = s.service_id
     WHERE usa.user_id = $1 AND s.service_code = 'GOOGLE_PLAY_CONSOLE'`,
    [userId]
  );

  if (accessRows.length === 0) {
    let serviceIdVal = null;
    try {
      const { rows } = await getPool().query(
        "SELECT service_id FROM services WHERE service_code = 'GOOGLE_PLAY_CONSOLE'"
      );
      if (rows.length > 0) serviceIdVal = rows[0].service_id;
    } catch (dbErr) {
      console.error(dbErr);
    }

    await logActivity({
      userId,
      serviceId: serviceIdVal,
      commandType: "OFFBOARD",
      status: "FAILED",
      errorMessage: `Google Play access record not found for user_id '${userId}'. (Code: 404)`,
    });

    return res.status(404).json({
      success: false,
      message: `Google Play access record not found for user_id '${userId}'.`,
    });
  }

  const { external_account_identifier, external_user_identifier, service_id } = accessRows[0];

  if (!external_account_identifier || !external_user_identifier) {
    await logActivity({
      userId,
      serviceId: service_id,
      commandType: "OFFBOARD",
      status: "FAILED",
      errorMessage: "Missing external_account_identifier or external_user_identifier in the database. (Code: 400)",
    });

    return res.status(400).json({
      success: false,
      message: "Missing external_account_identifier or external_user_identifier in the database.",
    });
  }

  try {
    const androidpublisher = await getGooglePlayClient();

    // 4. Call the users.delete API
    const name = `developers/${external_account_identifier}/users/${external_user_identifier}`;
    await androidpublisher.users.delete({ name });

    // Update local DB status to inactive
    await getPool().query(
      `UPDATE user_service_access
       SET is_active = false
       WHERE user_id = $1 AND service_id = $2`,
      [userId, service_id]
    );

    // Insert success log
    await logActivity({ userId, serviceId: service_id, commandType: "OFFBOARD", status: "SUCCESS" });

    res.json({
      success: true,
      message: `Successfully removed ${external_user_identifier} from Google Play Developer Console.`,
    });
  } catch (error) {
    console.error("Google Play API Error:", error);

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    // Insert failure log
    await logActivity({ userId, serviceId: service_id, commandType: "OFFBOARD", status: "FAILED", errorMessage: errMessage });

    res.status(500).json({
      success: false,
      message: "Failed to remove user via Google Play API.",
      error: errMessage,
    });
  }
}

/**
 * GET /google-play/developers/:developerId/users
 * Lists all users with access to a Google Play Developer account.
 */
async function listGooglePlayUsers(req, res) {
  const { developerId } = req.params;

  try {
    const androidpublisher = await getGooglePlayClient();
    
    // Call the users.list API (requires pageSize: -1 as pagination is disabled by Google)
    const parent = `developers/${developerId}`;
    const response = await androidpublisher.users.list({ parent, pageSize: -1 });

    res.json({
      success: true,
      developerId,
      data: response.data,
    });
  } catch (error) {
    console.error("Google Play API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list users via Google Play API.",
      error: error.message,
    });
  }
}

/**
 * POST /google-play/users/:userId
 * Onboards a user to Google Play Developer Console using their email from the local DB.
 */
async function onboardGooglePlayUser(req, res) {
  const { userId } = req.params;
  const developerId = process.env.GOOGLE_PLAY_DEVELOPERID;

  if (!developerId) {
    return res.status(500).json({
      success: false,
      message: "GOOGLE_PLAY_DEVELOPERID is not configured in the environment.",
    });
  }

  const userIdInt = Number.parseInt(userId, 10);
  if (!Number.isInteger(userIdInt)) {
    return res.status(400).json({
      success: false,
      message: "userId must be an integer.",
    });
  }

  const pool = getPool();
  let serviceIdVal = null;
  let userEmail = null;

  try {
    // 1. Fetch service_id for GOOGLE_PLAY_CONSOLE
    const { rows: serviceRows } = await pool.query(
      "SELECT service_id FROM services WHERE service_code = 'GOOGLE_PLAY_CONSOLE'"
    );
    if (serviceRows.length > 0) {
      serviceIdVal = serviceRows[0].service_id;
    }

    // 2. Fetch the user's email from the database
    const { rows: userRows } = await pool.query(
      "SELECT email FROM users WHERE user_id = $1",
      [userIdInt]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `User not found with user_id '${userIdInt}'.`,
      });
    }

    userEmail = userRows[0].email;

    // 3. Authenticate and call the users.create API using email and the minimum required permission
    const androidpublisher = await getGooglePlayClient();
    const parent = `developers/${developerId}`;

    const response = await androidpublisher.users.create({
      parent,
      requestBody: { 
        email: userEmail,
        developerAccountPermissions: ["CAN_VIEW_NON_FINANCIAL_DATA_GLOBAL"]
      },
    });

    // 4. Update / Insert user_service_access record
    if (serviceIdVal) {
      const { rows: accessRows } = await pool.query(
        `SELECT access_id 
         FROM user_service_access 
         WHERE user_id = $1 AND service_id = $2 AND external_account_identifier = $3`,
        [userIdInt, serviceIdVal, developerId]
      );

      if (accessRows.length > 0) {
        await pool.query(
          `UPDATE user_service_access
           SET is_active = true,
               external_user_identifier = $1,
               last_synced_at = NOW()
           WHERE access_id = $2`,
          [userEmail, accessRows[0].access_id]
        );
      } else {
        await pool.query(
          `INSERT INTO user_service_access (user_id, service_id, external_account_identifier, external_user_identifier, is_active, last_synced_at)
           VALUES ($1, $2, $3, $4, true, NOW())`,
          [userIdInt, serviceIdVal, developerId, userEmail]
        );
      }

      // 5. Insert success log
      await logActivity({ userId: userIdInt, serviceId: serviceIdVal, commandType: "ONBOARD", status: "SUCCESS" });
    }

    res.status(201).json({
      success: true,
      message: `Successfully onboarded user ${userEmail} to Google Play Developer Console.`,
      data: response.data,
    });
  } catch (error) {
    console.error("Google Play API Error:", error);

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

      await logActivity({ userId: userIdInt, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage });

    res.status(500).json({
      success: false,
      message: "Failed to onboard user via Google Play API.",
      error: errMessage,
    });
  }
}

/**
 * Helper function to instantiate an authenticated androidpublisher client.
 */
const { getCredentialFilePath } = require("../utils/credentialUtils");

async function getGooglePlayClient() {
  const keyFilePath = getCredentialFilePath("googleplay_json", ".json");

  if (!keyFilePath) {
    throw new Error("No .json credentials file found inside the googleplay_json folder.");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });

  return google.androidpublisher({ version: "v3", auth });
}

module.exports = { removeGooglePlayUser, listGooglePlayUsers, onboardGooglePlayUser };
