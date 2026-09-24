"use strict";

const { getPool } = require("../db/database");
const { logActivity } = require("../utils/logUtils");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const path = require("path");
const fs = require("fs");

const SERVICE_CODE = "FIREBASE";

const { readJsonCredential } = require("../utils/credentialUtils");

function getFirebaseAuth() {
  const serviceAccount = readJsonCredential("firebase_json");
  const projectId = serviceAccount.project_id;

  const existingApp = getApps().find(app => app.name === projectId);
  if (existingApp) {
    return getAuth(existingApp);
  }

  const app = initializeApp(
    { credential: cert(serviceAccount) },
    projectId
  );

  return getAuth(app);
}

function getFirebaseProjectId() {
  try {
    const key = readJsonCredential("firebase_json");
    return key.project_id || null;
  } catch (_err) {
    return null;
  }
}

async function onboardFirebaseUser(req, res) {
  const { userId } = req.params;

  let serviceIdVal = null;
  try {
    let { rows: accessRows } = await getPool().query(
      `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier, usa.role_name, usa.service_id
       FROM user_service_access usa
       JOIN services s ON usa.service_id = s.service_id
       WHERE usa.user_id = $1 AND s.service_code = $2 AND usa.is_active = false`,
      [userId, SERVICE_CODE]
    );

    if (accessRows.length === 0) {
      try {
        const { rows } = await getPool().query(
          "SELECT service_id FROM services WHERE service_code = $1",
          [SERVICE_CODE]
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }

      const { rows: userRows } = await getPool().query(
        "SELECT email, first_name || ' ' || last_name AS name FROM users WHERE user_id = $1",
        [userId]
      );

      if (userRows.length === 0) {
        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: `User not found with user_id '${userId}'.` });
        return res.status(404).json({
          success: false,
          message: `User not found with user_id '${userId}'.`,
        });
      }

      const userEmail = userRows[0].email;
      const projectId = getFirebaseProjectId();

      if (!projectId) {
        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: "Credentials file or project_id not found inside firebase_json folder." });
        return res.status(500).json({
          success: false,
          message: "No credentials file or project_id found inside firebase_json folder.",
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

    const auth = getFirebaseAuth();
    const results = [];

    for (const row of accessRows) {
      const { access_id, external_account_identifier: projectId, external_user_identifier, service_id } = row;
      serviceIdVal = service_id;

      if (!projectId || !external_user_identifier) {
        const errMessage = "Missing external_account_identifier or external_user_identifier in the database. (Code: 400)";
        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage });
        results.push({ access_id, status: "failed", error: "Missing Firebase Project ID or Email" });
        continue;
      }

      try {
        let firebaseUid = null;
        let created = false;

        try {
          const existingUser = await auth.getUserByEmail(external_user_identifier);
          firebaseUid = existingUser.uid;
        } catch (notFoundErr) {
          if (notFoundErr.code === "auth/user-not-found") {
            const { rows: nameRows } = await getPool().query(
              "SELECT first_name || ' ' || last_name AS name FROM users WHERE user_id = $1",
              [userId]
            );
            const displayName = nameRows[0]?.name || external_user_identifier;

            const newUser = await auth.createUser({
              email: external_user_identifier,
              displayName,
              emailVerified: false,
              disabled: false,
            });
            firebaseUid = newUser.uid;
            created = true;
          } else {
            throw notFoundErr;
          }
        }

        await getPool().query(
          `UPDATE user_service_access
           SET is_active = true, external_user_identifier = $1, last_synced_at = NOW()
           WHERE access_id = $2`,
          [firebaseUid, access_id]
        );

        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "SUCCESS" });

        console.log(`[Firebase/Auth] Successfully onboarded ${external_user_identifier} to ${projectId}. UID: ${firebaseUid}`);
        results.push({ access_id, project: projectId, firebaseUid, created, status: "onboarded" });
      } catch (error) {
        console.error("Firebase API Error for row:", error);
        const errCode = error.code || error.status || "500";
        const errMessage = `${error.message} (Code: ${errCode})`;

        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage });

        results.push({ access_id, project: projectId, status: "failed", error: errMessage });
      }
    }

    const successCount = results.filter(r => r.status === "onboarded").length;
    if (successCount === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to onboard user to Firebase.",
        data: results,
      });
    }

    res.json({
      success: true,
      message: `Successfully onboarded user to ${successCount} Firebase project(s).`,
      data: results,
    });
  } catch (error) {
    console.error("Firebase API Error overall:", error);

    if (!serviceIdVal) {
      try {
        const { rows } = await getPool().query(
          "SELECT service_id FROM services WHERE service_code = $1",
          [SERVICE_CODE]
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }
    }

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage });

    res.status(500).json({
      success: false,
      message: "Failed to onboard user via Firebase API.",
      error: errMessage,
    });
  }
}

async function removeFirebaseUser(req, res) {
  const { userId } = req.params;

  let serviceIdVal = null;
  try {
    const { rows: accessRows } = await getPool().query(
      `SELECT usa.external_account_identifier, usa.external_user_identifier, usa.service_id
       FROM user_service_access usa
       JOIN services s ON usa.service_id = s.service_id
       WHERE usa.user_id = $1 AND s.service_code = $2 AND usa.is_active = true`,
      [userId, SERVICE_CODE]
    );

    if (accessRows.length === 0) {
      try {
        const { rows } = await getPool().query(
          "SELECT service_id FROM services WHERE service_code = $1",
          [SERVICE_CODE]
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }

      await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "FAILED", errorMessage: `Firebase access record not found for user_id '${userId}'. (Code: 404)` });

      return res.status(404).json({
        success: false,
        message: `Firebase access record not found for user_id '${userId}'.`,
      });
    }

    const { external_account_identifier: projectId, external_user_identifier, service_id } = accessRows[0];
    serviceIdVal = service_id;

    if (!projectId || !external_user_identifier) {
      await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "FAILED", errorMessage: "Missing external_account_identifier or external_user_identifier in the database. (Code: 400)" });

      return res.status(400).json({
        success: false,
        message: "Missing external_account_identifier (Project ID) or external_user_identifier (Firebase UID or Email) in the database.",
      });
    }

    const auth = getFirebaseAuth();

    let firebaseUid = external_user_identifier;

    if (external_user_identifier.includes("@")) {
      const user = await auth.getUserByEmail(external_user_identifier);
      firebaseUid = user.uid;
    }

    await auth.deleteUser(firebaseUid);

    await getPool().query(
      `UPDATE user_service_access
       SET is_active = false
       WHERE user_id = $1 AND service_id = $2`,
      [userId, serviceIdVal]
    );

    await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "SUCCESS" });

    console.log(`[Firebase/Auth] Successfully removed ${external_user_identifier} from ${projectId}.`);

    res.json({
      success: true,
      message: `Successfully removed ${external_user_identifier} from Firebase project ${projectId}.`,
    });
  } catch (error) {
    console.error("Firebase API Error:", error);

    if (!serviceIdVal) {
      try {
        const { rows } = await getPool().query(
          "SELECT service_id FROM services WHERE service_code = $1",
          [SERVICE_CODE]
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }
    }

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "FAILED", errorMessage: errMessage });

    res.status(500).json({
      success: false,
      message: "Failed to remove user via Firebase API.",
      error: errMessage,
    });
  }
}

module.exports = { onboardFirebaseUser, removeFirebaseUser };
