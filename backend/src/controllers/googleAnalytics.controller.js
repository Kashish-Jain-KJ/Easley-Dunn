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

/**
 * Required local env:
 * GOOGLE_SERVICE_ACCOUNT_FILE=./googleanalytics_json/GAtest.json
 *
 * The JSON file should stay local and should not be committed.
 */
const { getPool } = require("../db/database");
const { GoogleAuth } = require("google-auth-library");
const path = require("path");
const fs = require("fs");

const SCHEMA = "easleydunn";
const SERVICE_CODE = "GOOGLE_ANALYTICS";
const COMMAND_NAME = "OFFBOARD_USER";

const GA_SCOPES = [
  "https://www.googleapis.com/auth/analytics.manage.users",
];

function getTriggeredBy(req) {
  return req.user?.email || req.headers["x-triggered-by"] || "system";
}

/**
 * DELETE /google-analytics-test/users/:userId
 */
async function removeGoogleAnalyticsUser(req, res) {
  const userId = Number.parseInt(req.params.userId, 10);
  const pool = getPool();

  let runId = null;

  if (!Number.isInteger(userId)) {
    return res.status(400).json({
      success: false,
      message: "userId must be an integer.",
    });
  }

  try {
    const { rows: serviceRows } = await pool.query(
      `
        SELECT service_id, service_code
        FROM ${SCHEMA}.services
        WHERE service_code = $1
          AND is_active = true
        LIMIT 1
      `,
      [SERVICE_CODE]
    );

    if (serviceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "GOOGLE_ANALYTICS service row not found.",
      });
    }

    const service = serviceRows[0];

    const { rows: runRows } = await pool.query(
      `
        INSERT INTO ${SCHEMA}.command_run (
          command_name,
          user_id,
          service_id,
          run_status,
          triggered_by,
          started_at
        )
        VALUES ($1, $2, $3, $4, $5, now())
        RETURNING run_id
      `,
      [
        COMMAND_NAME,
        userId,
        service.service_id,
        "running",
        getTriggeredBy(req),
      ]
    );

    runId = runRows[0].run_id;

    const stepLogIds = await createPendingSteps(pool, runId, [
      "Fetch local Google Analytics access record",
      "Authenticate with Google Analytics service account",
      "Resolve Google Analytics access binding",
      "Delete Google Analytics access binding",
      "Mark local access inactive",
    ]);

    const { user, accessRecord } = await runLoggedStep(
      pool,
      stepLogIds[1],
      async () => {
        const { rows } = await pool.query(
          `
            SELECT
              u.user_id,
              u.email,
              usa.access_id,
              usa.external_account_identifier,
              usa.external_user_identifier,
              usa.is_active
            FROM ${SCHEMA}.users u
            JOIN ${SCHEMA}.user_service_access usa
              ON u.user_id = usa.user_id
            JOIN ${SCHEMA}.services s
              ON usa.service_id = s.service_id
            WHERE u.user_id = $1
              AND s.service_code = $2
              AND usa.is_active = true
            LIMIT 1
          `,
          [userId, SERVICE_CODE]
        );

        if (rows.length === 0) {
          throw new Error(
            `Active Google Analytics access record not found for user_id '${userId}'.`
          );
        }

        if (!rows[0].external_account_identifier) {
          throw new Error(
            "Missing external_account_identifier. Expected value like accounts/123456789 or properties/123456789."
          );
        }

        if (!rows[0].external_user_identifier && !rows[0].email) {
          throw new Error("Missing external_user_identifier and user email.");
        }

        return {
          user: {
            user_id: rows[0].user_id,
            email: rows[0].email,
          },
          accessRecord: {
            access_id: rows[0].access_id,
            external_account_identifier: rows[0].external_account_identifier,
            external_user_identifier: rows[0].external_user_identifier,
          },
        };
      }
    );

    const authClient = await runLoggedStep(pool, stepLogIds[2], async () => {
      return getGoogleAnalyticsClient();
    });

    const bindingName = await runLoggedStep(pool, stepLogIds[3], async () => {
      return resolveAccessBindingName(
        authClient,
        accessRecord.external_account_identifier,
        accessRecord.external_user_identifier,
        user.email
      );
    });

    await runLoggedStep(pool, stepLogIds[4], async () => {
      await deleteAccessBinding(authClient, bindingName);
      return true;
    });

    await runLoggedStep(pool, stepLogIds[5], async () => {
      await pool.query(
        `
          UPDATE ${SCHEMA}.user_service_access
          SET is_active = false,
              last_synced_at = now()
          WHERE access_id = $1
        `,
        [accessRecord.access_id]
      );

      return true;
    });

    await pool.query(
      `
        UPDATE ${SCHEMA}.command_run
        SET run_status = $1,
            ended_at = now()
        WHERE run_id = $2
      `,
      ["done", runId]
    );

    return res.json({
      success: true,
      message: `Successfully removed Google Analytics access for user_id '${userId}'.`,
      runId,
      userId,
      email: user.email,
      bindingName,
    });
  } catch (error) {
    console.error("Google Analytics API Error:", error);

    if (runId) {
      await pool.query(
        `
          UPDATE ${SCHEMA}.command_run
          SET run_status = $1,
              ended_at = now(),
              failure_reason = $2
          WHERE run_id = $3
        `,
        ["failed", error.message, runId]
      );
    }

    return res.status(500).json({
      success: false,
      message: "Failed to remove user via Google Analytics Admin API.",
      runId,
      error: error.message,
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
function getGoogleAnalyticsKeyFilePath() {
  const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (!keyFilePath) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_FILE is required for Google Analytics service account testing."
    );
  }

  const resolvedPath = path.resolve(keyFilePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Google Analytics service account JSON not found at: ${resolvedPath}`
    );
  }

  const rawJson = fs.readFileSync(resolvedPath, "utf8");
  const parsedJson = JSON.parse(rawJson);

  if (!parsedJson.client_email || !parsedJson.private_key) {
    throw new Error(
      "The file in GOOGLE_SERVICE_ACCOUNT_FILE is not a service account JSON. It must contain client_email and private_key."
    );
  }

  return resolvedPath;
}

async function getGoogleAnalyticsClient() {
  const keyFilePath = getGoogleAnalyticsKeyFilePath();

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
      FROM ${SCHEMA}.user_service_access usa
      JOIN ${SCHEMA}.services s
        ON usa.service_id = s.service_id
      WHERE s.service_code = $1
        AND usa.external_account_identifier IS NOT NULL
      LIMIT 1
    `,
    [SERVICE_CODE]
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

async function createPendingSteps(pool, runId, stepNames) {
  const stepLogIds = {};

  for (let i = 0; i < stepNames.length; i += 1) {
    const stepNumber = i + 1;

    const { rows } = await pool.query(
      `
        INSERT INTO ${SCHEMA}.command_step_log (
          run_id,
          step_number,
          step_name,
          status
        )
        VALUES ($1, $2, $3, $4)
        RETURNING step_log_id
      `,
      [runId, stepNumber, stepNames[i], "pending"]
    );

    stepLogIds[stepNumber] = rows[0].step_log_id;
  }

  return stepLogIds;
}

async function runLoggedStep(pool, stepLogId, action) {
  await pool.query(
    `
      UPDATE ${SCHEMA}.command_step_log
      SET status = $1,
          started_at = now()
      WHERE step_log_id = $2
    `,
    ["running", stepLogId]
  );

  try {
    const result = await action();

    await pool.query(
      `
        UPDATE ${SCHEMA}.command_step_log
        SET status = $1,
            ended_at = now()
        WHERE step_log_id = $2
      `,
      ["done", stepLogId]
    );

    return result;
  } catch (error) {
    await pool.query(
      `
        UPDATE ${SCHEMA}.command_step_log
        SET status = $1,
            ended_at = now(),
            error_message = $2
        WHERE step_log_id = $3
      `,
      ["failed", error.message, stepLogId]
    );

    throw error;
  }
}

module.exports = {
  removeGoogleAnalyticsUser,
};