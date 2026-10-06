/**
 * @file googleAnalytics.controller.js
 * @description controller for Google Analytics Admin API using service account JSON only.
 *
 * POST   /google-analytics/users/:userId
 * Adds a user to Google Analytics access management.
 *
 * DELETE /google-analytics/users/:userId
 * Removes a user from Google Analytics access management.
 *
 * GET /google-analytics/access-bindings
 * Lists Google Analytics access bindings for testing.
 */

"use strict";

const { getPool } = require("../db/database");
const { logActivity } = require("../utils/logUtils");
const { GoogleAuth } = require("google-auth-library");
const path = require("path");
const fs = require("fs");

const GA_SCOPES = [
  "https://www.googleapis.com/auth/analytics.manage.users",
];

const { getCredentialFilePath } = require("../utils/credentialUtils");

/**
 * Service-account only.
 * Reads JSON key from googleanalytics_json folder.
 */
async function getGoogleAnalyticsClient() {
  const keyFilePath = getCredentialFilePath("googleanalytics_json", ".json");

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
    `SELECT usa.external_account_identifier
     FROM user_service_access usa
     JOIN services s ON usa.service_id = s.service_id
     WHERE s.service_code = $1
       AND usa.external_account_identifier IS NOT NULL
     LIMIT 1`,
    ["GOOGLE_ANALYTICS"]
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

  if (isFullAccessBindingName(identifier)) {
    return identifier;
  }

  if (isPartialAccessBindingName(identifier)) {
    return `${externalAccountIdentifier}/${identifier}`;
  }

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

  return `${externalAccountIdentifier}/accessBindings/${identifier}`;
}

async function deleteAccessBinding(authClient, bindingName) {
  await authClient.request({
    method: "DELETE",
    url: `https://analyticsadmin.googleapis.com/v1alpha/${bindingName}`,
  });
}

async function createAccessBinding(authClient, parentResource, email, role) {
  const response = await authClient.request({
    method: "POST",
    url: `https://analyticsadmin.googleapis.com/v1alpha/${parentResource}/accessBindings`,
    data: {
      user: email,
      roles: [role],
    },
  });

  return response.data;
}

/**
 * POST /google-analytics/users/:userId
 * Adds a user to Google Analytics with the mapped role.
 */
async function addGoogleAnalyticsUser(req, res) {
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
    // 1. Fetch inactive access rows
    let { rows: accessRows } = await pool.query(
      `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier, usa.role_name, usa.service_id, u.email
       FROM user_service_access usa
       JOIN services s ON usa.service_id = s.service_id
       JOIN users u ON usa.user_id = u.user_id
       WHERE usa.user_id = $1 AND s.service_code = 'GOOGLE_ANALYTICS' AND usa.is_active = false`,
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

      const { rows: userRows } = await pool.query(
        "SELECT email FROM users WHERE user_id = $1",
        [userId]
      );

      if (userRows.length === 0) {
        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: `User not found with user_id '${userId}'.`,
        performedBy: req.user?.name || req.user?.email || "System",
      });
        return res.status(404).json({
          success: false,
          message: `User not found with user_id '${userId}'.`,
        });
      }

      const userEmail = userRows[0].email;
      const parentResource = await getDefaultAnalyticsParentResource(pool);

      const { rows: newAccessRows } = await pool.query(
        `INSERT INTO user_service_access (user_id, service_id, external_account_identifier, external_user_identifier, role_name, is_active, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, false, NOW())
         RETURNING access_id, external_account_identifier, external_user_identifier, role_name, service_id`,
        [userId, serviceIdVal, parentResource, userEmail, "predefinedRoles/analyst"]
      );

      accessRows = newAccessRows.map(r => ({ ...r, email: userEmail }));
    }

    const authClient = await getGoogleAnalyticsClient();
    const results = [];

    for (const row of accessRows) {
      const { access_id, external_account_identifier, external_user_identifier, role_name, service_id, email } = row;
      serviceIdVal = service_id;

      if (!external_account_identifier) {
        const errMessage = "Missing external_account_identifier. (Code: 400)";
        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage , performedBy: req.user?.name || req.user?.email || "System" });
        results.push({ access_id, status: "failed", error: errMessage });
        continue;
      }

      try {
        const targetEmail = external_user_identifier && looksLikeEmail(external_user_identifier)
          ? external_user_identifier
          : email;

        const targetRole = role_name || "predefinedRoles/analyst";

        // Check if binding already exists
        const existingBinding = await findAccessBindingByEmail(
          authClient,
          external_account_identifier,
          targetEmail
        );

        let bindingName;
        if (existingBinding) {
          bindingName = existingBinding.name;
        } else {
          const newBinding = await createAccessBinding(
            authClient,
            external_account_identifier,
            targetEmail,
            targetRole
          );
          bindingName = newBinding.name;
        }

        // Update DB to active, store binding name
        await pool.query(
          `UPDATE user_service_access
           SET is_active = true, external_user_identifier = $1, last_synced_at = NOW()
           WHERE access_id = $2`,
          [bindingName, access_id]
        );

        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "SUCCESS" , performedBy: req.user?.name || req.user?.email || "System" });

        results.push({ access_id, parentResource: external_account_identifier, bindingName, status: "onboarded" });
      } catch (error) {
        console.error("Google Analytics API Error for row:", error);
        const errCode = error.code || error.status || "500";
        const errMessage = `${error.message} (Code: ${errCode})`;

        await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage , performedBy: req.user?.name || req.user?.email || "System" });

        results.push({ access_id, status: "failed", error: errMessage });
      }
    }

    const successCount = results.filter(r => r.status === "onboarded").length;
    if (successCount === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to onboard user to Google Analytics.",
        data: results,
      });
    }

    return res.json({
      success: true,
      message: `Successfully onboarded user to ${successCount} Google Analytics resource(s).`,
      data: results,
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

    await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage , performedBy: req.user?.name || req.user?.email || "System" });

    return res.status(500).json({
      success: false,
      message: "Failed to onboard user via Google Analytics Admin API.",
      error: errMessage,
    });
  }
}

/**
 * DELETE /google-analytics/users/:userId
 * Removes a user from Google Analytics access management.
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

      await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "FAILED", errorMessage: `Active Google Analytics access record not found for user_id '${userId}'. (Code: 404)`,
        performedBy: req.user?.name || req.user?.email || "System",
      });

      return res.status(404).json({
        success: false,
        message: `Active Google Analytics access record not found for user_id '${userId}'.`,
      });
    }

    const { access_id, external_account_identifier, external_user_identifier, service_id, email } = accessRows[0];
    serviceIdVal = service_id;

    if (!external_account_identifier) {
      await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "FAILED", errorMessage: "Missing external_account_identifier. (Code: 400)" , performedBy: req.user?.name || req.user?.email || "System" });

      return res.status(400).json({
        success: false,
        message: "Missing external_account_identifier.",
      });
    }

    const authClient = await getGoogleAnalyticsClient();

    const bindingName = await resolveAccessBindingName(
      authClient,
      external_account_identifier,
      external_user_identifier,
      email
    );

    await deleteAccessBinding(authClient, bindingName);

    await pool.query(
      `UPDATE user_service_access
       SET is_active = false,
           last_synced_at = NOW()
       WHERE access_id = $1`,
      [access_id]
    );

    await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "SUCCESS" , performedBy: req.user?.name || req.user?.email || "System" });

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

    await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "FAILED", errorMessage: errMessage , performedBy: req.user?.name || req.user?.email || "System" });

    return res.status(500).json({
      success: false,
      message: "Failed to remove user via Google Analytics Admin API.",
      error: errMessage,
    });
  }
}

/**
 * GET /google-analytics/access-bindings
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
        message: "Invalid parent resource. Expected accounts/123456789 or properties/123456789.",
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

module.exports = {
  addGoogleAnalyticsUser,
  removeGoogleAnalyticsUser,
  listGoogleAnalyticsAccessBindings,
};