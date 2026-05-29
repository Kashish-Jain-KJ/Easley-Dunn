/**
 * @file googleAnalytics.controller.js
 * @description controller for Google Analytics Admin API using service account JSON only.
 *
 * DELETE /google-analytics/users/:userId
 * Removes a user from Google Analytics access management.
 *
 * GET /google-analytics/access-bindings
 * Lists Google Analytics access bindings for testing.
 */

"use strict";

const { getPool } = require("../db/database");
const { GoogleAuth } = require("google-auth-library");
const path = require("path");
const fs = require("fs");

// No SCHEMA variable, loaded dynamically via connection pool schema path
const GA_SCOPES = [
  "https://www.googleapis.com/auth/analytics.manage.users",
];

/**
 * DELETE /google-analytics/users/:userId
 */
async function removeGoogleAnalyticsUser(req, res) {
  const userId = Number.parseInt(req.params.userId, 10);
  const pool = getPool();

  if (!Number.isInteger(userId)) {
    return res.status(400).json({
      success: false,
      message: "userId must be an integer.",
    });
  }

  let serviceIdVal = null;
  try {
    // 1. Fetch user access record
    const { rows: accessRows } = await pool.query(
      `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier, usa.service_id, u.email
       FROM user_service_access usa
       JOIN services s ON usa.service_id = s.service_id
       JOIN users u ON usa.user_id = u.user_id
       WHERE usa.user_id = $1 AND s.service_code = 'GOOGLE_ANALYTICS' AND usa.is_active = true`,
      [userId]
    );

    if (accessRows.length === 0) {
      try {
        const { rows } = await pool.query(
          "SELECT service_id FROM services WHERE service_code = 'GOOGLE_ANALYTICS'"
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }

      await pool.query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
        [userId, serviceIdVal, `Active Google Analytics access record not found for user_id '${userId}'. (Code: 404)`]
      );

      return res.status(404).json({
        success: false,
        message: `Active Google Analytics access record not found for user_id '${userId}'.`,
      });
    }

    const { access_id, external_account_identifier, external_user_identifier, service_id, email } = accessRows[0];
    serviceIdVal = service_id;

    if (!external_account_identifier) {
      await pool.query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
        [userId, serviceIdVal, "Missing external_account_identifier. (Code: 400)"]
      );

      return res.status(400).json({
        success: false,
        message: "Missing external_account_identifier.",
      });
    }

    // 2. Authenticate
    const authClient = await getGoogleAnalyticsClient();

    // 3. Resolve binding name
    const bindingName = await resolveAccessBindingName(
      authClient,
      external_account_identifier,
      external_user_identifier,
      email
    );

    // 4. Delete access binding
    await deleteAccessBinding(authClient, bindingName);

    // 5. Update local DB status to inactive
    await pool.query(
      `UPDATE user_service_access
       SET is_active = false,
           last_synced_at = NOW()
       WHERE access_id = $1`,
      [access_id]
    );

    // 6. Insert success log
    await pool.query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'OFFBOARD', 'SUCCESS', NULL, NOW())`,
      [userId, serviceIdVal]
    );

    return res.json({
      success: true,
      message: `Successfully removed Google Analytics access for user_id '${userId}'.`,
      userId,
      email,
      bindingName,
    });
  } catch (error) {
    console.error("Google Analytics API Error:", error);

    if (!serviceIdVal) {
      try {
        const { rows } = await pool.query(
          "SELECT service_id FROM services WHERE service_code = 'GOOGLE_ANALYTICS'"
        );
        if (rows.length > 0) serviceIdVal = rows[0].service_id;
      } catch (dbErr) {
        console.error(dbErr);
      }
    }

    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    // Insert failure log
    await pool.query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
      [userId, serviceIdVal, errMessage]
    );

    return res.status(500).json({
      success: false,
      message: "Failed to remove user via Google Analytics Admin API.",
      error: errMessage,
    });
  }
}

/**
 * GET /google-analytics-test/access-bindings
 */
async function listGoogleAnalyticsAccessBindings(req, res) {
  try {
    const pool = getPool();
    const authClient = await getGoogleAnalyticsClient();

    let parentResource =
      req.query.parent ||
      process.env.GOOGLE_ANALYTICS_PARENT_RESOURCE ||
      null;

    if (!parentResource) {
      parentResource = await getDefaultAnalyticsParentResource(pool);
    }

    if (!isValidParentResource(parentResource)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid parent resource. Expected accounts/123456789 or properties/123456789.",
      });
    }

    const bindings = await listAccessBindings(authClient, parentResource);

    return res.json({
      success: true,
      parentResource,
      count: bindings.length,
      data: bindings,
    });
  } catch (error) {
    console.error("Google Analytics API Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to list Google Analytics access bindings.",
      error: error.message,
    });
  }
}

/**
 * Service-account only.
 * Requires:
 * GOOGLE_SERVICE_ACCOUNT_FILE=./googleanalytics_json/GAtest.json
 */
async function getGoogleAnalyticsClient() {
  const folderPath = path.join(__dirname, "../../googleanalytics_json");
  let keyFilePath = null;

  if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    const files = fs.readdirSync(folderPath);
    const jsonFile = files.find((f) => f.endsWith(".json"));
    if (jsonFile) {
      keyFilePath = path.join(folderPath, jsonFile);
    }
  }

  if (!keyFilePath) {
    throw new Error("No .json credentials file found inside the googleanalytics_json folder.");
  }

  const auth = new GoogleAuth({
    keyFile: keyFilePath,
    scopes: GA_SCOPES,
  });

  return auth.getClient();
}

async function getDefaultAnalyticsParentResource(pool) {
  const { rows } = await pool.query(
    `
      SELECT usa.external_account_identifier
      FROM user_service_access usa
      JOIN services s
        ON usa.service_id = s.service_id
      WHERE s.service_code = $1
        AND usa.external_account_identifier IS NOT NULL
      LIMIT 1
    `,
    ['GOOGLE_ANALYTICS']
  );

  if (rows.length === 0) {
    throw new Error(
      "No external_account_identifier found for Google Analytics. Expected accounts/123456789 or properties/123456789."
    );
  }

  return rows[0].external_account_identifier;
}

function isValidParentResource(value) {
  return /^(accounts|properties)\/[^/]+$/.test(String(value || ""));
}

function isFullAccessBindingName(value) {
  return /^(accounts|properties)\/[^/]+\/accessBindings\/[^/]+$/.test(
    String(value || "")
  );
}

function isPartialAccessBindingName(value) {
  return /^accessBindings\/[^/]+$/.test(String(value || ""));
}

function looksLikeEmail(value) {
  return String(value || "").includes("@");
}

function normalizeGoogleAnalyticsUser(value) {
  return String(value || "")
    .replace(/^user:/i, "")
    .trim()
    .toLowerCase();
}

async function resolveAccessBindingName(
  authClient,
  externalAccountIdentifier,
  externalUserIdentifier,
  fallbackEmail
) {
  if (!isValidParentResource(externalAccountIdentifier)) {
    throw new Error(
      "external_account_identifier must look like accounts/123456789 or properties/123456789."
    );
  }

  const identifier = externalUserIdentifier || fallbackEmail;

  if (!identifier) {
    throw new Error("Missing external_user_identifier and fallback email.");
  }

  // Full value already stored:
  // accounts/123456789/accessBindings/123456789
  if (isFullAccessBindingName(identifier)) {
    return identifier;
  }

  // Partial value stored:
  // accessBindings/123456789
  if (isPartialAccessBindingName(identifier)) {
    return `${externalAccountIdentifier}/${identifier}`;
  }

  // Email stored:
  // kashishjain041@gmail.com
  if (looksLikeEmail(identifier)) {
    const binding = await findAccessBindingByEmail(
      authClient,
      externalAccountIdentifier,
      identifier
    );

    if (!binding) {
      throw new Error(
        `No Google Analytics access binding found for email '${identifier}'.`
      );
    }

    return binding.name;
  }

  // Raw access binding ID stored:
  // 123456789
  return `${externalAccountIdentifier}/accessBindings/${identifier}`;
}

async function listAccessBindings(authClient, parentResource) {
  let pageToken = null;
  const allBindings = [];

  do {
    const url = new URL(
      `https://analyticsadmin.googleapis.com/v1alpha/${parentResource}/accessBindings`
    );

    url.searchParams.set("pageSize", "200");

    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await authClient.request({
      method: "GET",
      url: url.toString(),
    });

    const bindings = response.data.accessBindings || [];
    allBindings.push(...bindings);

    pageToken = response.data.nextPageToken || null;
  } while (pageToken);

  return allBindings;
}

async function findAccessBindingByEmail(authClient, parentResource, email) {
  const bindings = await listAccessBindings(authClient, parentResource);
  const targetEmail = normalizeGoogleAnalyticsUser(email);

  return (
    bindings.find((binding) => {
      const bindingUser = normalizeGoogleAnalyticsUser(binding.user);
      return bindingUser === targetEmail;
    }) || null
  );
}

async function deleteAccessBinding(authClient, bindingName) {
  await authClient.request({
    method: "DELETE",
    url: `https://analyticsadmin.googleapis.com/v1alpha/${bindingName}`,
  });
}



module.exports = {
  removeGoogleAnalyticsUser,
};