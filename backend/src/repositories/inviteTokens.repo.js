/**
 * @file inviteTokens.repo.js
 * @description One-time tokens for setting a first password.
 *
 * Only the hash of a token is stored, the same reasoning as for a password:
 * the raw value exists in the email and nowhere else, so a copy of the database
 * cannot be turned into a working invite link.
 */

"use strict";

const crypto = require("crypto");
const { getPool } = require("../db/database");

const INVITE_DAYS = 7;

/**
 * How long each kind of link lasts, and how to say so in the email.
 *
 * An invite is expected and may have to survive a weekend, so it gets days. A
 * reset is unsolicited — if it was not the account's owner who asked, the link
 * is sitting in their mailbox — so it gets an hour, which is the usual window.
 */
const TTL = {
  INVITE: { interval: `${INVITE_DAYS} days`, label: `${INVITE_DAYS} days` },
  PASSWORD_RESET: { interval: "1 hour", label: "1 hour" },
};

/** The value that goes in the link. 32 bytes, URL-safe. */
function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a token, replacing any outstanding one of the same purpose for that
 * person: re-inviting someone, or asking for a second reset, must not leave an
 * older link working.
 * @returns {Promise<{token: string, expiresAt: Date}>} the raw token, which is
 *          never stored and cannot be recovered afterwards.
 */
async function issue(userId, purpose = "INVITE", db = getPool()) {
  const token = generateToken();
  await db.query(
    `DELETE FROM cerberus_admin_tokens WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [userId, purpose]
  );
  const ttl = TTL[purpose];
  if (!ttl) throw new Error(`Unknown token purpose '${purpose}'.`);
  const { rows } = await db.query(
    `INSERT INTO cerberus_admin_tokens (user_id, token_hash, purpose, expires_at)
     VALUES ($1, $2, $3, now() + $4::interval)
     RETURNING expires_at`,
    [userId, hash(token), purpose, ttl.interval]
  );
  return { token, expiresAt: rows[0].expires_at };
}

/**
 * The person a usable token belongs to, or null. A token that has been used or
 * has expired is not usable, and neither is one for an inactive account.
 */
async function findUsable(token, purpose = "INVITE", db = getPool()) {
  const { rows } = await db.query(
    `SELECT t.token_id, t.user_id, u.email, u.first_name, u.last_name, u.is_active
       FROM cerberus_admin_tokens t
       JOIN users u ON u.user_id = t.user_id
      WHERE t.token_hash = $1
        AND t.purpose = $2
        AND t.used_at IS NULL
        AND t.expires_at > now()`,
    [hash(token), purpose]
  );
  const row = rows[0];
  return row && row.is_active ? row : null;
}

async function markUsed(tokenId, db = getPool()) {
  await db.query(`UPDATE cerberus_admin_tokens SET used_at = now() WHERE token_id = $1`, [tokenId]);
}

module.exports = { issue, findUsable, markUsed, INVITE_DAYS, TTL };
