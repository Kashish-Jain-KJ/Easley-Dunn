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

    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
      [userId, serviceIdVal, `Google Play access record not found for user_id '${userId}'. (Code: 404)`]
    );

    return res.status(404).json({
      success: false,
      message: `Google Play access record not found for user_id '${userId}'.`,
    });
  }

  const { external_account_identifier, external_user_identifier, service_id } = accessRows[0];

  if (!external_account_identifier || !external_user_identifier) {
    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
      [userId, service_id, "Missing external_account_identifier or external_user_identifier in the database. (Code: 400)"]
    );

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
    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'OFFBOARD', 'SUCCESS', NULL, NOW())`,
      [userId, service_id]
    );

    res.json({
      success: true,
      message: `Successfully removed ${external_user_identifier} from Google Play Developer Console.`,
    });
  } catch (error) {
    console.error("Google Play API Error:", error);

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    // Insert failure log
    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
      [userId, service_id, errMessage]
    );

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
 * Helper function to instantiate an authenticated androidpublisher client.
 */
async function getGooglePlayClient() {
  const folderPath = path.join(__dirname, "../../googleplay_json");
  let keyFilePath = null;

  if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    const files = fs.readdirSync(folderPath);
    const jsonFile = files.find(f => f.endsWith(".json"));
    if (jsonFile) {
      keyFilePath = path.join(folderPath, jsonFile);
    }
  }

  if (!keyFilePath) {
    throw new Error("No .json credentials file found inside the googleplay_json folder.");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });

  return google.androidpublisher({ version: "v3", auth });
}

module.exports = { removeGooglePlayUser, listGooglePlayUsers };
