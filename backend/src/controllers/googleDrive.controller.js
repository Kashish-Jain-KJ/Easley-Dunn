/**
 * @file googleDrive.controller.js
 * @description Request handlers for Google Drive integrations.
 *
 * POST /google-drive/users/:userId/onboard  → grant a user access to their mapped Drive folders
 * DELETE /google-drive/users/:userId        → remove a user's access from all their Drive folders
 * GET /google-drive/users/:userId/audit     → list all files/folders still owned by the user
 */

"use strict";

const { getPool } = require("../db/database");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

// ─── Auth helper ─────────────────────────────────────────────────────────────

/**
 * Returns an authenticated Google Drive v3 client using the service account
 * JSON key found inside the googledrive_json folder.
 */
async function getDriveClient() {
  const folderPath = path.join(__dirname, "../../googledrive_json");
  let keyFilePath = null;

  if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    const files = fs.readdirSync(folderPath);
    const jsonFile = files.find((f) => f.endsWith(".json"));
    if (jsonFile) {
      keyFilePath = path.join(folderPath, jsonFile);
    }
  }

  if (!keyFilePath) {
    throw new Error("No .json credentials file found inside the googledrive_json folder.");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /google-drive/users/:userId/onboard
 * Grants a user access to all Drive folders mapped to them in user_service_access.
 * The external_account_identifier stores the folder ID.
 * The external_user_identifier stores the user's email.
 */
async function onboardGoogleDriveUser(req, res) {
  const { userId } = req.params;

  // 1. Fetch all Google Drive access records for this user
  const { rows: accessRows } = await getPool().query(
    `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier, usa.role_name
     FROM user_service_access usa
     JOIN services s ON usa.service_id = s.service_id
     WHERE usa.user_id = $1 AND s.service_code = 'GOOGLE_DRIVE' AND usa.is_active = false`,
    [userId]
  );

  if (accessRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `No inactive Google Drive access records found for user_id '${userId}'.`,
    });
  }

  const drive = await getDriveClient();
  const results = [];

  for (const row of accessRows) {
    const { access_id, external_account_identifier: folderId, external_user_identifier: email, role_name } = row;

    try {
      // 2. Grant access to the folder
      await drive.permissions.create({
        fileId: folderId,
        sendNotificationEmail: false,
        requestBody: {
          type: "user",
          role: role_name || "reader",
          emailAddress: email,
        },
      });

      // 3. Update is_active to true in the DB
      await getPool().query(
        `UPDATE user_service_access SET is_active = true, last_synced_at = NOW() WHERE access_id = $1`,
        [access_id]
      );

      results.push({ folderId, email, status: "onboarded" });
    } catch (error) {
      results.push({ folderId, email, status: "failed", error: error.message });
    }
  }

  res.json({
    success: true,
    message: `Onboarding complete for user_id '${userId}'.`,
    data: results,
  });
}

/**
 * DELETE /google-drive/users/:userId
 * Removes a user's access from all Drive folders mapped to them.
 * Runs an ownership audit first — if files are still owned by the user, blocks removal.
 */
async function offboardGoogleDriveUser(req, res) {
  const { userId } = req.params;

  // 1. Fetch all active Google Drive access records for this user
  const { rows: accessRows } = await getPool().query(
    `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier
     FROM user_service_access usa
     JOIN services s ON usa.service_id = s.service_id
     WHERE usa.user_id = $1 AND s.service_code = 'GOOGLE_DRIVE' AND usa.is_active = true`,
    [userId]
  );

  if (accessRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `No active Google Drive access records found for user_id '${userId}'.`,
    });
  }

  const userEmail = accessRows[0].external_user_identifier;
  const drive = await getDriveClient();

  // 2. Ownership audit — check for files still owned by this user
  const ownedFiles = await auditOwnedFiles(drive, userEmail);

  if (ownedFiles.length > 0) {
    return res.status(409).json({
      success: false,
      message: `Cannot offboard user. ${ownedFiles.length} file(s) are still owned by ${userEmail}. Ownership must be transferred before removal.`,
      ownedFiles,
    });
  }

  // 3. Remove access from each folder
  const results = [];

  for (const row of accessRows) {
    const { access_id, external_account_identifier: folderId } = row;

    try {
      // Find the user's permissionId on this folder
      const permList = await drive.permissions.list({
        fileId: folderId,
        fields: "permissions(id, emailAddress)",
      });

      const permission = permList.data.permissions?.find(
        (p) => p.emailAddress === userEmail
      );

      if (!permission) {
        results.push({ folderId, status: "not_found — user may have already lost access" });
        continue;
      }

      // Delete the permission
      await drive.permissions.delete({
        fileId: folderId,
        permissionId: permission.id,
      });

      // Update is_active to false in the DB
      await getPool().query(
        `UPDATE user_service_access SET is_active = false, last_synced_at = NOW() WHERE access_id = $1`,
        [access_id]
      );

      results.push({ folderId, status: "removed" });
    } catch (error) {
      results.push({ folderId, status: "failed", error: error.message });
    }
  }

  res.json({
    success: true,
    message: `Offboarding complete for user_id '${userId}'.`,
    data: results,
  });
}

/**
 * GET /google-drive/users/:userId/audit
 * Returns all files and folders in the mapped Drive folders still owned by the user.
 * Used as a pre-offboarding check.
 */
async function auditGoogleDriveOwnership(req, res) {
  const { userId } = req.params;

  // 1. Get the user's email from DB
  const { rows: userRows } = await getPool().query(
    `SELECT email FROM users WHERE user_id = $1`,
    [userId]
  );

  if (userRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `User not found for user_id '${userId}'.`,
    });
  }

  const userEmail = userRows[0].email;
  const drive = await getDriveClient();

  const ownedFiles = await auditOwnedFiles(drive, userEmail);

  res.json({
    success: true,
    userEmail,
    ownedFileCount: ownedFiles.length,
    message: ownedFiles.length === 0
      ? "No owned files found. Safe to offboard."
      : `${ownedFiles.length} file(s) still owned by this user. Ownership must be transferred before offboarding.`,
    data: ownedFiles,
  });
}

// ─── Internal helper ─────────────────────────────────────────────────────────

/**
 * Returns all files/folders owned by the given email using the Drive API.
 * Used internally by both offboardGoogleDriveUser and auditGoogleDriveOwnership.
 */
async function auditOwnedFiles(drive, email) {
  const response = await drive.files.list({
    q: `'${email}' in owners and trashed = false`,
    fields: "files(id, name, mimeType, webViewLink, owners)",
    pageSize: 100,
  });

  return response.data.files || [];
}

module.exports = { onboardGoogleDriveUser, offboardGoogleDriveUser, auditGoogleDriveOwnership };