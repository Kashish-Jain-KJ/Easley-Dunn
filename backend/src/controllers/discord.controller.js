/**
 * @file discord.controller.js
 * @description Request handlers for Discord integrations.
 *
 * Discord has no service-account JSON key — auth is a single bot token
 * (DISCORD_BOT_TOKEN) sent as `Authorization: Bot <token>` on every REST call.
 *
 * The bot can only manage members already in the guild; it cannot add someone
 * cold. Onboarding instead generates a single-use invite (mirroring how
 * kanboard.controller.js emails credentials when a service can't be fully
 * automated) and emails it via the same SMTP config Kanboard already uses.
 * Role assignment inside the server (team channels, etc.) is handled entirely
 * by the server's existing Carl-bot reaction-role setup — out of scope here.
 *
 * POST   /discord/users/:userId              → generate + email a one-time server invite
 * DELETE /discord/users/:userId              → kick the user from the guild
 * POST   /discord/users/:userId/confirm      → resolve a self-reported Discord username to a
 *                                               real user ID and record it on the access row
 * GET    /discord/users/:userId/confirm-page → plain HTML form (no JS) that POSTs to the
 *                                               /confirm route above — this is the link the
 *                                               invite email sends people to
 */

"use strict";

const { getPool } = require("../db/database");
const { logActivity } = require("../utils/logUtils");
const { getMailTransporter } = require("../utils/mail");

const SERVICE_CODE = "DISCORD";
const DISCORD_API_BASE = "https://discord.com/api/v10";

/**
 * Required env:
 * DISCORD_BOT_TOKEN=your-bot-token
 * DISCORD_INVITE_CHANNEL_ID=the-channel-id-invites-are-created-against
 * MAIL_SMTP_HOSTNAME / MAIL_SMTP_PORT / MAIL_SMTP_USERNAME / MAIL_SMTP_PASSWORD / MAIL_FROM
 *   (already configured for kanboard.controller.js — reused here)
 *
 * Optional env:
 * DISCORD_GUILD_ID=fallback-guild-id-used-when-no-access-row-exists-yet
 */

function getDiscordBotToken() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured in the environment.");
  return token;
}

function getAppBaseUrl() {
  return process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
}

async function sendInviteEmail(toEmail, inviteUrl, confirmPageUrl) {
  const fromEmail = process.env.MAIL_FROM || process.env.MAIL_SMTP_USERNAME;
  const transporter = getMailTransporter();

  await transporter.sendMail({
    from: fromEmail,
    to: toEmail,
    subject: "You've been invited to the Easley-Dunn Discord",
    text: `Hi,\n\nYou've been invited to join the Easley-Dunn Discord server. This invite is single-use and expires in 24 hours:\n\n${inviteUrl}\n\nOnce you're in, check #welcome to pick your team role, then confirm your Discord username here so we can manage your access:\n\n${confirmPageUrl}\n\nBest,\nEasley-Dunn`,
    html: `
      <p>Hi,</p>
      <p>You've been invited to join the Easley-Dunn Discord server. This invite is single-use and expires in 24 hours:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>Once you're in, check #welcome to pick your team role, then <a href="${confirmPageUrl}">confirm your Discord username here</a> so we can manage your access.</p>
      <p>Best,<br/>Easley-Dunn</p>
    `,
  });
}

/**
 * Thin fetch() wrapper for authenticated Discord REST calls. Normalises
 * non-2xx responses into a thrown Error with .code / .status set, matching
 * the shape the other controllers already expect from failed API calls.
 */
async function discordRequest(method, endpoint, body) {
  const token = getDiscordBotToken();

  const response = await fetch(`${DISCORD_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Discord returns 204 No Content on successful member/invite mutations
  if (response.status === 204) return null;

  const rawBody = await response.text();
  let data;
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch (_error) {
    throw new Error(`Invalid Discord API response: ${rawBody}`);
  }

  if (!response.ok) {
    const err = new Error(data.message || `Discord API request failed with status ${response.status}`);
    err.code = data.code || response.status;
    err.status = response.status;
    throw err;
  }

  return data;
}

async function createDiscordInvite(channelId) {
  const invite = await discordRequest("POST", `/channels/${channelId}/invites`, {
    max_age: 86400, // 24 hours
    max_uses: 1,
    unique: true,
  });
  return `https://discord.gg/${invite.code}`;
}

async function getDiscordServiceId() {
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

async function getDefaultGuildId() {
  if (process.env.DISCORD_GUILD_ID) {
    return process.env.DISCORD_GUILD_ID;
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

/**
 * Fetches this user's inactive Discord access rows, auto-creating one against
 * the default guild if none exist yet. external_user_identifier is left NULL —
 * unlike email-based services, Discord has no way to resolve a member from an
 * email address, so the real Discord user ID has to be recorded manually
 * after the person accepts the invite and joins. Offboarding will fail with a
 * clear error until that's done.
 */
async function getOrCreateInactiveAccessRows(userId, serviceIdVal) {
  const { rows: accessRows } = await getPool().query(
    `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier, usa.service_id
     FROM user_service_access usa
     JOIN services s ON usa.service_id = s.service_id
     WHERE usa.user_id = $1 AND s.service_code = $2 AND usa.is_active = false`,
    [userId, SERVICE_CODE]
  );

  if (accessRows.length > 0) return accessRows;

  const defaultGuildId = await getDefaultGuildId();
  if (!defaultGuildId) return [];

  const { rows: newAccessRows } = await getPool().query(
    `INSERT INTO user_service_access (user_id, service_id, external_account_identifier, external_user_identifier, is_active, last_synced_at)
     VALUES ($1, $2, $3, NULL, false, NOW())
     RETURNING access_id, external_account_identifier, external_user_identifier, service_id`,
    [userId, serviceIdVal, defaultGuildId]
  );

  return newAccessRows;
}

/**
 * POST /discord/users/:userId
 * Generates a single-use, 24-hour Discord invite and emails it to the user.
 */
async function onboardDiscordUser(req, res) {
  const userId = Number.parseInt(req.params.userId, 10);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ success: false, message: "userId must be an integer." });
  }

  const serviceIdVal = await getDiscordServiceId();

  if (!serviceIdVal) {
    return res.status(404).json({ success: false, message: "DISCORD service row not found." });
  }

  const localUser = await getLocalUser(userId);

  if (!localUser) {
    await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: `User not found with user_id '${userId}'.`,
        performedBy: req.user?.name || req.user?.email || "System",
      });
    return res.status(404).json({ success: false, message: `User not found with user_id '${userId}'.` });
  }

  const accessRows = await getOrCreateInactiveAccessRows(userId, serviceIdVal);

  if (accessRows.length === 0) {
    const errMessage = `No inactive Discord access records found for user_id '${userId}', and DISCORD_GUILD_ID is not configured as a fallback.`;
    await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage , performedBy: req.user?.name || req.user?.email || "System" });
    return res.status(404).json({ success: false, message: errMessage });
  }

  const results = [];

  for (const row of accessRows) {
    const { access_id, external_account_identifier: guildId } = row;

    if (!guildId) {
      const errMessage = "Missing Discord guild ID (external_account_identifier). (Code: 400)";
      await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage , performedBy: req.user?.name || req.user?.email || "System" });
      results.push({ access_id, status: "failed", error: "Missing Discord guild ID" });
      continue;
    }

    try {
      const inviteChannelId = process.env.DISCORD_INVITE_CHANNEL_ID;
      if (!inviteChannelId) {
        throw new Error("DISCORD_INVITE_CHANNEL_ID is not configured in the environment.");
      }

      const inviteUrl = await createDiscordInvite(inviteChannelId);
      const confirmPageUrl = `${getAppBaseUrl()}/discord/users/${userId}/confirm-page`;

      let emailSent = false;
      try {
        await sendInviteEmail(localUser.email, inviteUrl, confirmPageUrl);
        emailSent = true;
      } catch (mailError) {
        console.error("Failed to send Discord invite email:", mailError.message);
      }

      // Reset external_user_identifier — a fresh invite starts a new
      // confirmation cycle, so any ID from a previous cycle must not be
      // trusted until the person re-confirms via the confirm-page.
      await getPool().query(
        `UPDATE user_service_access SET is_active = true, external_user_identifier = NULL, last_synced_at = NOW() WHERE access_id = $1`,
        [access_id]
      );

      await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "SUCCESS" , performedBy: req.user?.name || req.user?.email || "System" });

      console.log(`[Discord] Successfully generated an invite for ${localUser.email} to guild ${guildId}.`);
      results.push({ access_id, guild: guildId, inviteUrl, emailSent, status: "onboarded" });
    } catch (error) {
      console.error("Discord API Error for row:", error);
      const errCode = error.code || error.status || "500";
      const errMessage = `${error.message} (Code: ${errCode})`;

      await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage , performedBy: req.user?.name || req.user?.email || "System" });

      results.push({ access_id, guild: guildId, status: "failed", error: errMessage });
    }
  }

  const successCount = results.filter((r) => r.status === "onboarded").length;

  if (successCount === 0) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate a Discord invite for any guild.",
      data: results,
    });
  }

  return res.json({
    success: true,
    message: `Successfully sent a Discord invite for ${successCount} guild(s).`,
    data: results,
  });
}

/**
 * DELETE /discord/users/:userId
 * Kicks the user from the mapped guild(s). Requires external_user_identifier
 * (the real Discord user ID) to already be recorded on the access row.
 */
async function removeDiscordUser(req, res) {
  const userId = Number.parseInt(req.params.userId, 10);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ success: false, message: "userId must be an integer." });
  }

  const serviceIdVal = await getDiscordServiceId();

  const { rows: accessRows } = await getPool().query(
    `SELECT usa.access_id, usa.external_account_identifier, usa.external_user_identifier, usa.service_id
     FROM user_service_access usa
     JOIN services s ON usa.service_id = s.service_id
     WHERE usa.user_id = $1 AND s.service_code = $2 AND usa.is_active = true`,
    [userId, SERVICE_CODE]
  );

  if (accessRows.length === 0) {
    await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "FAILED", errorMessage: `No active Discord access record found for user_id '${userId}'. (Code: 404)`,
        performedBy: req.user?.name || req.user?.email || "System",
      });
    return res.status(404).json({
      success: false,
      message: `No active Discord access record found for user_id '${userId}'.`,
    });
  }

  const results = [];

  for (const row of accessRows) {
    const { access_id, external_account_identifier: guildId, external_user_identifier: discordUserId } = row;

    if (!guildId || !discordUserId) {
      const errMessage = "Missing Discord guild ID (external_account_identifier) or Discord user ID (external_user_identifier) in the database. (Code: 400)";
      await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "FAILED", errorMessage: errMessage , performedBy: req.user?.name || req.user?.email || "System" });
      results.push({ access_id, status: "failed", error: "Missing Discord guild ID or Discord user ID" });
      continue;
    }

    try {
      await discordRequest("DELETE", `/guilds/${guildId}/members/${discordUserId}`);

      await getPool().query(
        `UPDATE user_service_access SET is_active = false, last_synced_at = NOW() WHERE access_id = $1`,
        [access_id]
      );

      await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "SUCCESS" , performedBy: req.user?.name || req.user?.email || "System" });

      console.log(`[Discord] Successfully kicked ${discordUserId} from guild ${guildId}.`);
      results.push({ access_id, guild: guildId, status: "kicked" });
    } catch (error) {
      console.error("Discord API Error for row:", error);
      const errCode = error.code || error.status || "500";
      const errMessage = `${error.message} (Code: ${errCode})`;

      await logActivity({ userId, serviceId: serviceIdVal, commandType: "OFFBOARD", status: "FAILED", errorMessage: errMessage , performedBy: req.user?.name || req.user?.email || "System" });

      results.push({ access_id, guild: guildId, status: "failed", error: errMessage });
    }
  }

  const successCount = results.filter((r) => r.status === "kicked").length;

  if (successCount === 0) {
    return res.status(500).json({
      success: false,
      message: "Failed to kick user from any Discord guilds.",
      data: results,
    });
  }

  return res.json({
    success: true,
    message: `Successfully kicked user from ${successCount} Discord guild(s).`,
    data: results,
  });
}

/**
 * POST /discord/users/:userId/confirm
 * Resolves a self-reported Discord username to a real user ID via the
 * Search Guild Members endpoint, and records it on the user's Discord
 * access row. This is how external_user_identifier actually gets filled
 * in — Discord has no way to look up a member by email, so the person has
 * to self-report their username once, after they've joined via the invite
 * from onboardDiscordUser.
 *
 * Expected body: { username }
 */
async function confirmDiscordUsername(req, res) {
  const userId = Number.parseInt(req.params.userId, 10);
  const { username } = req.body;

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ success: false, message: "userId must be an integer." });
  }

  if (!username || typeof username !== "string") {
    return res.status(400).json({ success: false, message: "username is required." });
  }

  const serviceIdVal = await getDiscordServiceId();

  const { rows: accessRows } = await getPool().query(
    `SELECT usa.access_id, usa.external_account_identifier
     FROM user_service_access usa
     JOIN services s ON usa.service_id = s.service_id
     WHERE usa.user_id = $1 AND s.service_code = $2
     ORDER BY usa.last_synced_at DESC NULLS LAST
     LIMIT 1`,
    [userId, SERVICE_CODE]
  );

  if (accessRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `No Discord access record found for user_id '${userId}'.`,
    });
  }

  const { access_id, external_account_identifier: guildId } = accessRows[0];

  if (!guildId) {
    return res.status(400).json({
      success: false,
      message: "Missing Discord guild ID (external_account_identifier) on the access record.",
    });
  }

  try {
    const matches = await discordRequest(
      "GET",
      `/guilds/${guildId}/members/search?query=${encodeURIComponent(username)}&limit=5`
    );

    if (!Array.isArray(matches) || matches.length === 0) {
      throw new Error(`No Discord member found matching username '${username}' in this guild.`);
    }

    const exactMatch = matches.find(
      (m) => m.user?.username?.toLowerCase() === username.toLowerCase()
    );
    const matched = exactMatch || matches[0];
    const discordUserId = matched.user?.id;

    if (!discordUserId) {
      throw new Error("Discord search returned a result with no user ID.");
    }

    await getPool().query(
      `UPDATE user_service_access SET external_user_identifier = $1, last_synced_at = NOW() WHERE access_id = $2`,
      [discordUserId, access_id]
    );

    await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "SUCCESS" , performedBy: req.user?.name || req.user?.email || "System" });

    console.log(`[Discord] Linked username '${username}' to user ID ${discordUserId} for user_id '${userId}'.`);

    return res.json({
      success: true,
      message: `Linked Discord user '${matched.user.username}' (${discordUserId}) to user_id '${userId}'.`,
      discordUserId,
    });
  } catch (error) {
    console.error("Discord username confirmation error:", error);
    const errCode = error.code || error.status || "500";
    const errMessage = `${error.message} (Code: ${errCode})`;

    await logActivity({ userId, serviceId: serviceIdVal, commandType: "ONBOARD", status: "FAILED", errorMessage: errMessage , performedBy: req.user?.name || req.user?.email || "System" });

    return res.status(500).json({
      success: false,
      message: "Failed to confirm Discord username.",
      error: errMessage,
    });
  }
}

/**
 * GET /discord/users/:userId/confirm-page
 * Plain HTML form, no JavaScript — the browser's native form submission POSTs
 * straight to /discord/users/:userId/confirm (express.urlencoded() already
 * parses that into req.body.username, same as the JSON path). This is the
 * link included in the invite email so a person can self-report their
 * Discord username without needing an API client.
 */
async function renderConfirmPage(req, res) {
  const userId = Number.parseInt(req.params.userId, 10);

  if (!Number.isInteger(userId)) {
    return res.status(400).type("html").send("<h1>Invalid link</h1><p>userId must be an integer.</p>");
  }

  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Confirm your Discord username — Easley-Dunn</title>
</head>
<body>
<h1>Confirm your Discord username</h1>
<p>Enter the Discord username you used to join the Easley-Dunn Discord server. This links your account so we can manage your access.</p>
<form method="POST" action="/discord/users/${userId}/confirm">
<label for="username">Discord username</label><br/>
<input type="text" id="username" name="username" required autofocus />
<button type="submit">Submit</button>
</form>
</body>
</html>`);
}

/**
 * GET /discord/users/:userId/status
 * Reports whether this user has been onboarded to Discord and whether
 * they've completed the confirm-page step. Read-only — no log inserts,
 * same as the existing GET /users/:userId/access endpoint.
 */
async function getDiscordStatus(req, res) {
  const userId = Number.parseInt(req.params.userId, 10);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ success: false, message: "userId must be an integer." });
  }

  const { rows } = await getPool().query(
    `SELECT usa.is_active, usa.external_user_identifier
     FROM user_service_access usa
     JOIN services s ON usa.service_id = s.service_id
     WHERE usa.user_id = $1 AND s.service_code = $2
     ORDER BY usa.last_synced_at DESC NULLS LAST
     LIMIT 1`,
    [userId, SERVICE_CODE]
  );

  if (rows.length === 0) {
    return res.json({
      success: true,
      userId,
      onboarded: false,
      confirmed: false,
      discordUserId: null,
    });
  }

  const { is_active, external_user_identifier } = rows[0];

  return res.json({
    success: true,
    userId,
    onboarded: is_active,
    confirmed: Boolean(external_user_identifier),
    discordUserId: external_user_identifier || null,
  });
}

module.exports = { onboardDiscordUser, removeDiscordUser, confirmDiscordUsername, renderConfirmPage, getDiscordStatus };
