/**
 * @file appleStoreConnect.controller.js
 * @description Request handlers for Apple Store Connect integrations.
 */

"use strict";

const { getPool } = require("../db/database");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

/**
 * Helper to generate ES256 JWT for App Store Connect API requests.
 */
function generateAppleJWT(privateKeyPem, keyId, issuerId) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT"
  };

  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 1200, // Expires in 20 minutes (maximum permitted)
    aud: "appstoreconnect-v1"
  };

  const base64UrlEncode = (obj) => {
    return Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(payload);

  const sign = crypto.createSign("SHA256");
  sign.update(`${headerB64}.${payloadB64}`);

  const rawSignature = sign.sign({
    key: privateKeyPem,
    dsaEncoding: "ieee-p1363"
  });

  const signatureB64 = rawSignature
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Helper to load the private key from the apple_key directory or env variables.
 */
function getApplePrivateKey() {
  // If private key is configured as string in env, use it directly (e.g. for testing)
  if (process.env.APPLE_PRIVATE_KEY) {
    return process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  }

  const folderPath = path.join(__dirname, "../../apple_key");
  if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    const files = fs.readdirSync(folderPath);
    const p8File = files.find((f) => f.endsWith(".p8"));
    if (p8File) {
      const keyFilePath = path.join(folderPath, p8File);
      return fs.readFileSync(keyFilePath, "utf8");
    }
  }

  return null;
}

/**
 * POST /appleStoreConnect/users/:userId
 * Onboards/invites a user to Apple Store Connect Developer Team.
 */
async function onboardAppleStoreConnectUser(req, res) {
  const { userId } = req.params;

  const userIdInt = Number.parseInt(userId, 10);
  if (!Number.isInteger(userIdInt)) {
    return res.status(400).json({
      success: false,
      message: "userId must be an integer.",
    });
  }

  const appleKeyId = process.env.APPLE_KEY_ID;
  const appleIssuerId = process.env.APPLE_ISSUER_ID;

  if (!appleKeyId || !appleIssuerId) {
    return res.status(500).json({
      success: false,
      message: "APPLE_KEY_ID and APPLE_ISSUER_ID must be configured in the environment.",
    });
  }

  const pool = getPool();
  let serviceIdVal = null;
  let userEmail = null;
  let firstName = null;
  let lastName = null;

  try {
    // 1. Fetch service_id for APPLE_STORE_CONNECT
    const { rows: serviceRows } = await pool.query(
      "SELECT service_id FROM services WHERE service_code = 'APPLE_STORE_CONNECT'"
    );
    if (serviceRows.length > 0) {
      serviceIdVal = serviceRows[0].service_id;
    }

    // 2. Fetch the user's details (email, names) from local database
    const { rows: userRows } = await pool.query(
      "SELECT email, first_name, last_name FROM users WHERE user_id = $1",
      [userIdInt]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `User not found with user_id '${userIdInt}'.`,
      });
    }

    userEmail = userRows[0].email;
    firstName = userRows[0].first_name;
    lastName = userRows[0].last_name;

    // 3. Load private key
    const privateKey = getApplePrivateKey();
    if (!privateKey) {
      const errMessage = "No .p8 credentials file found inside the apple_key folder.";
      if (serviceIdVal) {
        await pool.query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
          [userIdInt, serviceIdVal, errMessage]
        );
      }
      return res.status(500).json({
        success: false,
        message: errMessage,
      });
    }

    // 4. Fetch or Insert user_service_access record in inactive state
    let accessId = null;
    if (serviceIdVal) {
      const { rows: accessRows } = await pool.query(
        "SELECT access_id FROM user_service_access WHERE user_id = $1 AND service_id = $2 AND external_account_identifier = $3",
        [userIdInt, serviceIdVal, appleIssuerId]
      );

      if (accessRows.length > 0) {
        accessId = accessRows[0].access_id;
      } else {
        const { rows: insertRows } = await pool.query(
          "INSERT INTO user_service_access (user_id, service_id, external_account_identifier, external_user_identifier, is_active, last_synced_at) VALUES ($1, $2, $3, $4, false, NOW()) RETURNING access_id",
          [userIdInt, serviceIdVal, appleIssuerId, userEmail]
        );
        if (insertRows && insertRows.length > 0) {
          accessId = insertRows[0].access_id;
        }
      }
    }

    // 5. Generate Apple Store Connect JWT
    let token;
    try {
      token = generateAppleJWT(privateKey, appleKeyId, appleIssuerId);
    } catch (jwtErr) {
      console.error("JWT signing failed:", jwtErr);
      const errMessage = `JWT creation failed: ${jwtErr.message}`;
      if (serviceIdVal) {
        await pool.query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
          [userIdInt, serviceIdVal, errMessage]
        );
      }
      return res.status(500).json({
        success: false,
        message: errMessage,
      });
    }

    // 6. Invite user via Apple API
    const response = await fetch("https://api.appstoreconnect.apple.com/v1/userInvitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        data: {
          type: "userInvitations",
          attributes: {
            email: userEmail,
            firstName: firstName,
            lastName: lastName,
            roles: ["DEVELOPER"],
            allAppsVisible: true
          }
        }
      })
    });

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errDetail = responseBody.errors
        ?.map((e) => `${e.title}: ${e.detail} (Code: ${e.code})`)
        .join(", ") || `API Request failed with status ${response.status}`;
      
      const errMessage = `${errDetail} (Code: ${response.status})`;

      if (serviceIdVal) {
        await pool.query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
          [userIdInt, serviceIdVal, errMessage]
        );
      }

      return res.status(response.status || 500).json({
        success: false,
        message: "Failed to onboard/invite user via Apple Store Connect API.",
        error: errMessage,
      });
    }

    // 7. Update DB record to active and insert log
    if (accessId) {
      await pool.query(
        `UPDATE user_service_access
         SET is_active = true,
             external_user_identifier = $1,
             last_synced_at = NOW()
         WHERE access_id = $2`,
        [userEmail, accessId]
      );
    }

    if (serviceIdVal) {
      await pool.query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'ONBOARD', 'SUCCESS', NULL, NOW())`,
        [userIdInt, serviceIdVal]
      );
    }

    return res.status(201).json({
      success: true,
      message: `Successfully onboarded user ${userEmail} to Apple Store Connect.`,
      data: responseBody.data,
    });
  } catch (error) {
    console.error("Apple Store Connect Onboarding Error:", error);

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    if (serviceIdVal) {
      await pool.query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
        [userIdInt, serviceIdVal, errMessage]
      );
    }

    return res.status(500).json({
      success: false,
      message: "Failed to onboard user via Apple Store Connect API.",
      error: errMessage,
    });
  }
}

/**
 * DELETE /appleStoreConnect/users/:userId
 * Offboards/removes a user from Apple Store Connect.
 */
async function offboardAppleStoreConnectUser(req, res) {
  const { userId } = req.params;

  const userIdInt = Number.parseInt(userId, 10);
  if (!Number.isInteger(userIdInt)) {
    return res.status(400).json({
      success: false,
      message: "userId must be an integer.",
    });
  }

  const appleKeyId = process.env.APPLE_KEY_ID;
  const appleIssuerId = process.env.APPLE_ISSUER_ID;

  if (!appleKeyId || !appleIssuerId) {
    return res.status(500).json({
      success: false,
      message: "APPLE_KEY_ID and APPLE_ISSUER_ID must be configured in the environment.",
    });
  }

  const pool = getPool();
  let serviceIdVal = null;

  try {
    // 1. Fetch service_id for APPLE_STORE_CONNECT
    const { rows: serviceRows } = await pool.query(
      "SELECT service_id FROM services WHERE service_code = 'APPLE_STORE_CONNECT'"
    );
    if (serviceRows.length > 0) {
      serviceIdVal = serviceRows[0].service_id;
    }

    // 2. Fetch the user's active Apple Store Connect access record from DB
    const { rows: accessRows } = await pool.query(
      "SELECT access_id, external_user_identifier FROM user_service_access WHERE user_id = $1 AND service_id = $2 AND is_active = true",
      [userIdInt, serviceIdVal]
    );

    if (accessRows.length === 0) {
      const errMessage = `Apple Store Connect access record not found or already inactive for user_id '${userIdInt}'.`;
      if (serviceIdVal) {
        await pool.query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
          [userIdInt, serviceIdVal, errMessage]
        );
      }
      return res.status(404).json({
        success: false,
        message: errMessage,
      });
    }

    const { access_id, external_user_identifier: userEmail } = accessRows[0];

    // 3. Load private key
    const privateKey = getApplePrivateKey();
    if (!privateKey) {
      const errMessage = "No .p8 credentials file found inside the apple_key folder.";
      if (serviceIdVal) {
        await pool.query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
          [userIdInt, serviceIdVal, errMessage]
        );
      }
      return res.status(500).json({
        success: false,
        message: errMessage,
      });
    }

    // 4. Generate JWT
    const token = generateAppleJWT(privateKey, appleKeyId, appleIssuerId);

    // 5. Look up the user by email on Apple Store Connect to get their ID
    // We check active users first
    let appleUserId = null;
    let isInvitation = false;

    const usersResponse = await fetch("https://api.appstoreconnect.apple.com/v1/users?limit=200", {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      const matchedUser = (usersData.data || []).find(
        (u) => u.attributes?.username?.toLowerCase() === userEmail.toLowerCase()
      );
      if (matchedUser) {
        appleUserId = matchedUser.id;
      }
    }

    // If not found in active users, check pending invitations list
    if (!appleUserId) {
      const invitesResponse = await fetch("https://api.appstoreconnect.apple.com/v1/userInvitations?limit=200", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (invitesResponse.ok) {
        const invitesData = await invitesResponse.json();
        const matchedInvite = (invitesData.data || []).find(
          (inv) => inv.attributes?.email?.toLowerCase() === userEmail.toLowerCase()
        );
        if (matchedInvite) {
          appleUserId = matchedInvite.id;
          isInvitation = true;
        }
      }
    }

    if (!appleUserId) {
      const errMessage = `User ${userEmail} not found in Apple Store Connect active members or pending invitations.`;
      if (serviceIdVal) {
        await pool.query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
          [userIdInt, serviceIdVal, errMessage]
        );
      }
      return res.status(404).json({
        success: false,
        message: errMessage,
      });
    }

    // 6. Delete the user / invitation
    const deleteUrl = isInvitation
      ? `https://api.appstoreconnect.apple.com/v1/userInvitations/${appleUserId}`
      : `https://api.appstoreconnect.apple.com/v1/users/${appleUserId}`;

    const deleteResponse = await fetch(deleteUrl, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!deleteResponse.ok) {
      const responseBody = await deleteResponse.json().catch(() => ({}));
      const errDetail = responseBody.errors
        ?.map((e) => `${e.title}: ${e.detail} (Code: ${e.code})`)
        .join(", ") || `Delete request failed with status ${deleteResponse.status}`;

      const errMessage = `${errDetail} (Code: ${deleteResponse.status})`;

      if (serviceIdVal) {
        await pool.query(
          `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
           VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
          [userIdInt, serviceIdVal, errMessage]
        );
      }

      return res.status(deleteResponse.status || 500).json({
        success: false,
        message: "Failed to delete user via Apple Store Connect API.",
        error: errMessage,
      });
    }

    // 7. Update DB record to inactive & log success
    await pool.query(
      `UPDATE user_service_access
       SET is_active = false,
           last_synced_at = NOW()
       WHERE access_id = $1`,
      [access_id]
    );

    if (serviceIdVal) {
      await pool.query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'OFFBOARD', 'SUCCESS', NULL, NOW())`,
        [userIdInt, serviceIdVal]
      );
    }

    return res.json({
      success: true,
      message: `Successfully removed ${userEmail} from Apple Store Connect.`,
    });
  } catch (error) {
    console.error("Apple Store Connect Offboarding Error:", error);

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    if (serviceIdVal) {
      await pool.query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
        [userIdInt, serviceIdVal, errMessage]
      );
    }

    return res.status(500).json({
      success: false,
      message: "Failed to offboard user via Apple Store Connect API.",
      error: errMessage,
    });
  }
}

module.exports = { onboardAppleStoreConnectUser, offboardAppleStoreConnectUser, generateAppleJWT };
