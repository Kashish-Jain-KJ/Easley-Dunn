/**
 * @file googleDrive.controller.js
 * @description Request handlers for Google Drive integrations.
 *
 * POST /google-drive/users/:userId          → grant a user access to their mapped Drive folder
 * DELETE /google-drive/users/:userId        → remove a user's access from their Drive folder
 */

"use strict";

const { getPool } = require("../db/database");
const { google } = require("googleapis");
const { logActivity } = require("../utils/logUtils");

const SERVICE_CODE = "GOOGLE_DRIVE";
const TARGET_ROLE = "reader";

// ─── Auth helper ─────────────────────────────────────────────────────────────

const { getCredentialFilePath } = require("../utils/credentialUtils");

/**
 * Returns an authenticated Google Drive v3 client using the service account
 * JSON key found inside the googledrive_json folder.
 */
async function getDriveClient() {
  const keyFilePath = getCredentialFilePath("googledrive_json", ".json");

  if (!keyFilePath) {
    throw new Error("No .json credentials file found inside the googledrive_json folder.");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

async function getDriveServiceId() {
  const { rows } = await getPool().query(
    "SELECT service_id FROM services WHERE service_code = $1",
    [SERVICE_CODE]
  );
  return rows.length > 0 ? rows[0].service_id : null;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /google-drive/users/:userId
 * Grants a user access to the Drive folder mapped to them in user_service_access.
 * The external_account_identifier stores the folder ID.
 * The external_user_identifier stores the user's email.
 */
async function onboardGoogleDriveUser(req, res) {
  const { userId } = req.params;
  const performedBy = req.user?.name || req.user?.email || "System";
  const actorUserId = req.user?.userId ?? null;

  let serviceIdVal = null;
  try {
    // 1. Fetch the user's inactive Google Drive access records
    let { rows: accessRows } = await getPool().query(
      `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier, usa.role_name, usa.service_id
       FROM user_service_access usa
       JOIN services s ON usa.service_id = s.service_id
       WHERE usa.user_id = $1 AND s.service_code = $2 AND usa.is_active = false`,
      [userId, SERVICE_CODE]
    );

    if (accessRows.length === 0) {
      serviceIdVal = await getDriveServiceId();

      if (!serviceIdVal) {
        throw new Error(`${SERVICE_CODE} service row not found.`);
      }

      // Fetch user's email to create the record
      const { rows: userRows } = await getPool().query(
        "SELECT email FROM users WHERE user_id = $1",
        [userId]
      );

      if (userRows.length === 0) {
        const errMessage = `User not found with user_id '${userId}'.`;
        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage, performedBy, actorUserId });
        return res.status(404).json({ success: false, message: errMessage });
      }

      const userEmail = userRows[0].email;

      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      if (!folderId) {
        throw new Error("GOOGLE_DRIVE_FOLDER_ID is not configured in the environment.");
      }

      // Insert new inactive access record
      const { rows: newAccessRows } = await getPool().query(
        `INSERT INTO user_service_access (user_id, service_id, external_account_identifier, external_user_identifier, is_active, last_synced_at)
         VALUES ($1, $2, $3, $4, false, NOW())
         RETURNING access_id, external_account_identifier, external_user_identifier, role_name, service_id`,
        [userId, serviceIdVal, folderId, userEmail]
      );

      accessRows = newAccessRows;
    }

    // 2. Authenticate with Google Drive
    const drive = await getDriveClient();
    const results = [];

    for (const row of accessRows) {
      const { access_id, external_account_identifier: folderId, external_user_identifier: email, service_id } = row;
      serviceIdVal = service_id;

      if (!folderId || !email) {
        const errMessage = "Missing external_account_identifier or external_user_identifier in the database. (Code: 400)";
        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage, performedBy, actorUserId });
        results.push({ access_id, status: "failed", error: "Missing Folder ID or Email" });
        continue;
      }

      try {
        // 3. Grant access to the folder
        await drive.permissions.create({
          fileId: folderId,
          sendNotificationEmail: false,
          requestBody: {
            type: "user",
            role: TARGET_ROLE,
            emailAddress: email,
          },
        });

        // 4. Update is_active to true in the DB
        await getPool().query(
          `UPDATE user_service_access SET is_active = true, last_synced_at = NOW() WHERE access_id = $1`,
          [access_id]
        );

        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "SUCCESS", performedBy, actorUserId });

        console.log(`[GoogleDrive] Successfully added ${email} to folder ${folderId} with role ${TARGET_ROLE}.`);
        results.push({ access_id, folderId, email, role: TARGET_ROLE, status: "onboarded" });
      } catch (error) {
        console.error("Google Drive API Error for row:", error);
        const errCode = error.code || error.status || "500";
        const errMessage = `${error.message} (Code: ${errCode})`;

        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage, performedBy, actorUserId });

        results.push({ access_id, folderId, email, status: "failed", error: errMessage });
      }
    }

    const successCount = results.filter((r) => r.status === "onboarded").length;
    if (successCount === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to onboard user to any Google Drive folders.",
        data: results,
      });
    }

    res.json({
      success: true,
      message: `Successfully onboarded user to ${successCount} Google Drive folder(s).`,
      data: results,
    });
  } catch (error) {
    console.error("Google Drive API Error overall:", error);

    if (!serviceIdVal) {
      try {
        serviceIdVal = await getDriveServiceId();
      } catch (dbErr) {
        console.error(dbErr);
      }
    }

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage, performedBy, actorUserId });

    res.status(500).json({
      success: false,
      message: "Failed to onboard user via Google Drive API.",
      error: errMessage,
    });
  }
}

/**
 * DELETE /google-drive/users/:userId
 * Removes a user's access from the Drive folder mapped to them.
 * Runs an ownership audit first — if files are still owned by the user, blocks removal.
 */
async function offboardGoogleDriveUser(req, res) {
  const { userId } = req.params;
  const performedBy = req.user?.name || req.user?.email || "System";
  const actorUserId = req.user?.userId ?? null;

  let serviceIdVal = null;
  try {
    // 1. Fetch the user's Google Drive access record
    const { rows: accessRows } = await getPool().query(
      `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier, usa.service_id
       FROM user_service_access usa
       JOIN services s ON usa.service_id = s.service_id
       WHERE usa.user_id = $1 AND s.service_code = $2
       ORDER BY usa.access_id`,
      [userId, SERVICE_CODE]
    );

    if (accessRows.length === 0) {
      serviceIdVal = await getDriveServiceId();
      const errMessage = `Google Drive access record not found for user_id '${userId}'.`;

      await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "FAILED", errorMessage: `${errMessage} (Code: 404)`, performedBy, actorUserId });

      return res.status(404).json({ success: false, message: errMessage });
    }

    const { external_account_identifier: folderId, external_user_identifier: userEmail, service_id } = accessRows[0];
    serviceIdVal = service_id;

    if (!folderId || !userEmail) {
      await logActivity({
        userId,
        serviceId: serviceIdVal,
        commandType: "OFFBOARD",
        status: "FAILED",
        errorMessage: "Missing external_account_identifier or external_user_identifier in the database. (Code: 400)",
        performedBy,
        actorUserId,
      });

      return res.status(400).json({
        success: false,
        message: "Missing external_account_identifier (Folder ID) or external_user_identifier (Email) in the database.",
      });
    }

    const drive = await getDriveClient();

    // 2. Ownership audit — check for files still owned by this user
    const ownedFiles = await auditOwnedFiles(drive, userEmail);

    if (ownedFiles.length > 0) {
      await logActivity({
        userId,
        serviceId: serviceIdVal,
        commandType: "OFFBOARD",
        status: "FAILED",
        errorMessage: `Cannot offboard user. ${ownedFiles.length} file(s) are still owned by ${userEmail}. (Code: 409)`,
        performedBy,
        actorUserId,
      });

      return res.status(409).json({
        success: false,
        message: `Cannot offboard user. ${ownedFiles.length} file(s) are still owned by ${userEmail}. Ownership must be transferred before removal.`,
        ownedFiles,
      });
    }

    // 3. Find the user's permissionId on this folder
    const permList = await drive.permissions.list({
      fileId: folderId,
      fields: "permissions(id, emailAddress)",
    });

    const permission = permList.data.permissions?.find(
      (p) => p.emailAddress === userEmail
    );

    if (permission) {
      await drive.permissions.delete({
        fileId: folderId,
        permissionId: permission.id,
      });
    }

    // 4. Update is_active to false in the DB for all of this user's Drive rows
    await getPool().query(
      `UPDATE user_service_access
       SET is_active = false, last_synced_at = NOW()
       WHERE user_id = $1 AND service_id = $2`,
      [userId, serviceIdVal]
    );

    if (!permission) {
      // Already removed — nothing to delete, local state is now in sync.
      await logActivity({
        userId,
        serviceId: serviceIdVal,
        commandType: "OFFBOARD",
        status: "SUCCESS",
        errorMessage: `Already removed: no permission for ${userEmail} on folder '${folderId}'. Marked inactive.`,
        performedBy,
        actorUserId,
      });

      return res.json({
        success: true,
        message: `${userEmail} was already removed from Google Drive folder ${folderId}; marked inactive.`,
      });
    }

    await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "SUCCESS", performedBy, actorUserId });

    console.log(`[GoogleDrive] Successfully removed ${userEmail} from folder ${folderId}.`);

    res.json({
      success: true,
      message: `Successfully removed ${userEmail} from Google Drive folder ${folderId}.`,
    });
  } catch (error) {
    console.error("Google Drive API Error:", error);

    if (!serviceIdVal) {
      try {
        serviceIdVal = await getDriveServiceId();
      } catch (dbErr) {
        console.error(dbErr);
      }
    }

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "FAILED", errorMessage: errMessage, performedBy, actorUserId });

    res.status(500).json({
      success: false,
      message: "Failed to remove user via Google Drive API.",
      error: errMessage,
    });
  }
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
