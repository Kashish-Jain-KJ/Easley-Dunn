/**
 * @file kanboard.controller.js
 * @description Request handlers for Kanboard integrations.
 *
 * POST   /kanboard/users/:userId             → onboard a user to Kanboard
 * DELETE /kanboard/users/:userId             → offboard a user from Kanboard
 * POST   /kanboard/users/:userId/invite-test → test Kanboard invite mechanism
 */

"use strict";

const crypto = require("crypto");
const { getPool } = require("../db/database");
const { getMailTransporter } = require("../utils/mail");

/**
 * Required env:
 * KANBOARD_API_URL=https://your-kanboard-domain/jsonrpc.php
 * KANBOARD_API_USERNAME=jsonrpc
 * KANBOARD_API_TOKEN=your-kanboard-api-token
 * KANBOARD_URL=https://your-kanboard-domain
 * MAIL_SMTP_HOSTNAME=smtp.gmail.com
 * MAIL_SMTP_PORT=587
 * MAIL_SMTP_USERNAME=your-email@gmail.com
 * MAIL_SMTP_PASSWORD=your-app-password
 * MAIL_FROM=noreply@easleydunnproductions.com
 *
 * Optional env:
 * KANBOARD_DEFAULT_PROJECT_ID=1
 * KANBOARD_DEFAULT_ROLE=project-member
 */

const SERVICE_CODE = "KANBOARD";

function getKanboardConfig() {
  const apiUrl = process.env.KANBOARD_API_URL;
  const username = process.env.KANBOARD_API_USERNAME || "jsonrpc";
  const token = process.env.KANBOARD_API_TOKEN;

  if (!apiUrl) throw new Error("KANBOARD_API_URL is not configured in the environment.");
  if (!token) throw new Error("KANBOARD_API_TOKEN is not configured in the environment.");

  return { apiUrl, username, token };
}

async function sendCredentialsEmail(toEmail, username, temporaryPassword) {
  const kanboardUrl = process.env.KANBOARD_URL || process.env.KANBOARD_API_URL?.replace("/jsonrpc.php", "");
  const fromEmail = process.env.MAIL_FROM || process.env.MAIL_SMTP_USERNAME;

  const transporter = getMailTransporter();

  await transporter.sendMail({
    from: fromEmail,
    to: toEmail,
    subject: "You have been invited to Kanboard",
    text: `Hi,\n\nYou have been added to Kanboard. Here are your login credentials:\n\nURL: ${kanboardUrl}\nUsername: ${username}\nPassword: ${temporaryPassword}\n\nPlease log in and change your password after your first login.\n\nBest,\nEasley-Dunn`,
    html: `
      <p>Hi,</p>
      <p>You have been added to Kanboard. Here are your login credentials:</p>
      <table>
        <tr><td><strong>URL</strong></td><td><a href="${kanboardUrl}">${kanboardUrl}</a></td></tr>
        <tr><td><strong>Username</strong></td><td>${username}</td></tr>
        <tr><td><strong>Password</strong></td><td>${temporaryPassword}</td></tr>
      </table>
      <p>Please log in and change your password after your first login.</p>
      <p>Best,<br/>Easley-Dunn Games</p>
    `,
  });
}

async function callKanboard(method, params = {}, options = {}) {
  const { apiUrl, username, token } = getKanboardConfig();

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      id: Date.now(),
      params,
    }),
  });

  const rawBody = await response.text();

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (_error) {
    throw new Error(`Invalid Kanboard API response: ${rawBody}`);
  }

  if (!response.ok) {
    throw new Error(`Kanboard API HTTP error: ${response.statusText || "Request failed"} (${response.status})`);
  }

  if (body.error) {
    throw new Error(body.error.message || "Kanboard API returned an error.");
  }

  if (body.result === false && !options.allowFalseResult) {
    throw new Error(`${method} returned false.`);
  }

  if (body.result === null && !options.allowNullResult) {
    throw new Error(`${method} returned null.`);
  }

  return body.result;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isNumericId(value) {
  return /^\d+$/.test(String(value || "").trim());
}

function buildUsername(email, userId) {
  const localPart = String(email || "")
    .split("@")[0]
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
  return localPart ? `${localPart}-${userId}` : `user-${userId}`;
}

function generateTemporaryPassword() {
  return crypto.randomBytes(18).toString("base64url");
}

async function getKanboardServiceId() {
  const { rows } = await getPool().query(
    "SELECT service_id FROM services WHERE service_code = $1",
    [SERVICE_CODE]
  );
  return rows.length > 0 ? rows[0].service_id : null;
}

async function getLocalUser(userId) {
  const { rows } = await getPool().query(
    `SELECT user_id, first_name || ' ' || last_name AS name, email FROM users WHERE user_id = $1`,
    [userId]
  );
  if (rows.length === 0) return null;
  return { user_id: rows[0].user_id, email: rows[0].email, name: rows[0].name };
}

async function getDefaultProjectId() {
  if (process.env.KANBOARD_DEFAULT_PROJECT_ID) {
    return process.env.KANBOARD_DEFAULT_PROJECT_ID;
  }

  const { rows } = await getPool().query(
    `SELECT usa.external_account_identifier
     FROM user_service_access usa
     JOIN services s ON usa.service_id = s.service_id
     WHERE s.service_code = $1
       AND usa.external_account_identifier IS NOT NULL
     LIMIT 1`,
    [SERVICE_CODE]
  );

  return rows.length > 0 ? rows[0].external_account_identifier : null;
}

async function getOrCreateInactiveAccessRows(userId, localUser, serviceIdVal) {
  const { rows: accessRows } = await getPool().query(
    `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier, usa.role_name, usa.service_id
     FROM user_service_access usa
     JOIN services s ON usa.service_id = s.service_id
     WHERE usa.user_id = $1 AND s.service_code = $2 AND usa.is_active = false`,
    [userId, SERVICE_CODE]
  );

  if (accessRows.length > 0) return accessRows;

  const defaultProjectId = await getDefaultProjectId();
  if (!defaultProjectId) return [];

  const defaultRole = process.env.KANBOARD_DEFAULT_ROLE || "project-member";

  const { rows: newAccessRows } = await getPool().query(
    `INSERT INTO user_service_access (user_id, service_id, external_account_identifier, external_user_identifier, role_name, is_active, last_synced_at)
     VALUES ($1, $2, $3, $4, $5, false, NOW())
     RETURNING access_id, external_account_identifier, external_user_identifier, role_name, service_id`,
    [userId, serviceIdVal, defaultProjectId, localUser.email, defaultRole]
  );

  return newAccessRows;
}

async function findKanboardUser(externalUserIdentifier, fallbackEmail) {
  const candidates = [externalUserIdentifier, fallbackEmail, fallbackEmail ? fallbackEmail.split("@")[0] : null].filter(Boolean);

  for (const candidate of candidates) {
    if (isNumericId(candidate)) {
      const user = await callKanboard("getUser", { user_id: Number(candidate) }, { allowNullResult: true });
      if (user && user.id) return user;
    }
  }

  for (const candidate of candidates) {
    const user = await callKanboard("getUserByName", { username: candidate }, { allowNullResult: true });
    if (user && user.id) return user;
  }

  const allUsers = await callKanboard("getAllUsers", {}, { allowFalseResult: true });
  if (Array.isArray(allUsers)) {
    for (const candidate of candidates) {
      const matchedUser = allUsers.find((user) =>
        normalize(user.id) === normalize(candidate) ||
        normalize(user.username) === normalize(candidate) ||
        normalize(user.email) === normalize(candidate)
      );
      if (matchedUser && matchedUser.id) return matchedUser;
    }
  }

  return null;
}

async function createKanboardUser(localUser) {
  const username = buildUsername(localUser.email, localUser.user_id);
  const temporaryPassword = generateTemporaryPassword();

  const kanboardUserId = await callKanboard("createUser", {
    username,
    password: temporaryPassword,
    name: localUser.name || username,
    email: localUser.email,
    role: "app-user",
  });

  return { id: kanboardUserId, username, email: localUser.email, temporaryPassword };
}

async function grantKanboardProjectAccess(projectId, kanboardUserId, role) {
  const result = await callKanboard(
    "addProjectUser",
    [Number(projectId), Number(kanboardUserId), role],
    { allowFalseResult: true }
  );

  if (result === true) return true;

  const existingRole = await callKanboard(
    "getProjectUserRole",
    [Number(projectId), Number(kanboardUserId)],
    { allowFalseResult: true }
  );

  if (existingRole) return true;

  throw new Error("Unable to grant Kanboard project access.");
}

async function revokeKanboardProjectAccess(projectId, kanboardUserId) {
  await callKanboard(
    "removeProjectUser",
    [Number(projectId), Number(kanboardUserId)],
    { allowFalseResult: true }
  );
  return true;
}

async function onboardKanboardUser(req, res) {
  const userId = Number.parseInt(req.params.userId, 10);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ success: false, message: "userId must be an integer." });
  }

  const serviceIdVal = await getKanboardServiceId();

  if (!serviceIdVal) {
    return res.status(404).json({ success: false, message: "KANBOARD service row not found." });
  }

  const localUser = await getLocalUser(userId);

  if (!localUser) {
    const errMessage = `User not found with user_id '${userId}'.`;
    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
      [userId, serviceIdVal, errMessage]
    );
    return res.status(404).json({ success: false, message: errMessage });
  }

  const accessRows = await getOrCreateInactiveAccessRows(userId, localUser, serviceIdVal);

  if (accessRows.length === 0) {
    const errMessage = `No inactive Kanboard access records found for user_id '${userId}'.`;
    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
      [userId, serviceIdVal, errMessage]
    );
    return res.status(404).json({ success: false, message: errMessage });
  }

  const results = [];

  for (const row of accessRows) {
    const { access_id, external_account_identifier: projectId, external_user_identifier, role_name } = row;

    if (!projectId) {
      const errMessage = "Missing Kanboard project ID";
      await getPool().query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
        [userId, serviceIdVal, errMessage]
      );
      results.push({ access_id, status: "failed", error: errMessage });
      continue;
    }

    try {
      let kanboardUser = await findKanboardUser(external_user_identifier, localUser.email);
      let createdUser = false;
      let emailSent = false;

      if (!kanboardUser) {
        // Step 1 — create the user account
        kanboardUser = await createKanboardUser(localUser);
        createdUser = true;

        // Step 3 — send credentials email
        try {
          await sendCredentialsEmail(localUser.email, kanboardUser.username, kanboardUser.temporaryPassword);
          emailSent = true;
        } catch (mailError) {
          console.error("Failed to send Kanboard credentials email:", mailError.message);
        }
      }

      const kanboardUserId = Number(kanboardUser.id);
      const role = role_name || process.env.KANBOARD_DEFAULT_ROLE || "project-member";

      // Step 2 — add user to project
      await grantKanboardProjectAccess(projectId, kanboardUserId, role);

      await getPool().query(
        `UPDATE user_service_access SET is_active = true, external_user_identifier = $1, last_synced_at = NOW() WHERE access_id = $2`,
        [String(kanboardUserId), access_id]
      );

      await getPool().query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'ONBOARD', 'SUCCESS', NULL, NOW())`,
        [userId, serviceIdVal]
      );

      results.push({ access_id, projectId, kanboardUserId, role, createdUser, emailSent, status: "onboarded" });
    } catch (error) {
      const errMessage = error.message;
      await getPool().query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'ONBOARD', 'FAILED', $3, NOW())`,
        [userId, serviceIdVal, errMessage]
      );
      results.push({ access_id, projectId, status: "failed", error: errMessage });
    }
  }

  const successCount = results.filter((r) => r.status === "onboarded").length;

  if (successCount === 0) {
    return res.status(500).json({ success: false, message: "Failed to onboard user to any Kanboard projects.", data: results });
  }

  return res.json({ success: true, message: `Successfully onboarded user to ${successCount} Kanboard project(s).`, data: results });
}

async function offboardKanboardUser(req, res) {
  const userId = Number.parseInt(req.params.userId, 10);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ success: false, message: "userId must be an integer." });
  }

  const serviceIdVal = await getKanboardServiceId();

  const { rows: accessRows } = await getPool().query(
    `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier, usa.service_id, u.email
     FROM user_service_access usa
     JOIN services s ON usa.service_id = s.service_id
     JOIN users u ON usa.user_id = u.user_id
     WHERE usa.user_id = $1 AND s.service_code = $2 AND usa.is_active = true`,
    [userId, SERVICE_CODE]
  );

  if (accessRows.length === 0) {
    const errMessage = `Kanboard access record not found for user_id '${userId}'.`;
    await getPool().query(
      `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
       VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
      [userId, serviceIdVal, errMessage]
    );
    return res.status(404).json({ success: false, message: errMessage });
  }

  const results = [];

  for (const row of accessRows) {
    const { access_id, external_account_identifier: projectId, external_user_identifier, email } = row;

    if (!projectId || !external_user_identifier) {
      const errMessage = "Missing Kanboard project ID or user identifier";
      await getPool().query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
        [userId, serviceIdVal, errMessage]
      );
      results.push({ access_id, status: "failed", error: errMessage });
      continue;
    }

    try {
      const kanboardUser = await findKanboardUser(external_user_identifier, email);

      if (!kanboardUser || !kanboardUser.id) {
        throw new Error(`Kanboard user not found for '${external_user_identifier}'.`);
      }

      const kanboardUserId = Number(kanboardUser.id);

      await revokeKanboardProjectAccess(projectId, kanboardUserId);

      await getPool().query(
        `UPDATE user_service_access SET is_active = false, last_synced_at = NOW() WHERE access_id = $1`,
        [access_id]
      );

      await getPool().query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'OFFBOARD', 'SUCCESS', NULL, NOW())`,
        [userId, serviceIdVal]
      );

      results.push({ access_id, projectId, kanboardUserId, status: "removed" });
    } catch (error) {
      const errMessage = error.message;
      await getPool().query(
        `INSERT INTO log (user_id, service_id, command_type, status, error_message, created_at)
         VALUES ($1, $2, 'OFFBOARD', 'FAILED', $3, NOW())`,
        [userId, serviceIdVal, errMessage]
      );
      results.push({ access_id, projectId, status: "failed", error: errMessage });
    }
  }

  const successCount = results.filter((r) => r.status === "removed").length;

  if (successCount === 0) {
    return res.status(500).json({ success: false, message: "Failed to remove user from any Kanboard projects.", data: results });
  }

  return res.json({ success: true, message: `Successfully removed user from ${successCount} Kanboard project(s).`, data: results });
}

async function testKanboardInviteUser(req, res) {
  const userId = Number.parseInt(req.params.userId, 10);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ success: false, message: "userId must be an integer." });
  }

  const localUser = await getLocalUser(userId);

  if (!localUser) {
    return res.status(404).json({ success: false, message: `User not found with user_id '${userId}'.` });
  }

  return res.status(501).json({
    success: false,
    message: "The Kanboard invite API method is not exposed via JSON-RPC. Onboarding uses createUser + addProjectUser + credentials email instead.",
  });
}

module.exports = { onboardKanboardUser, offboardKanboardUser, testKanboardInviteUser };
