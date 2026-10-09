/**
 * @file session.service.js
 * @description Session lifecycle operations, called from controllers.
 *
 * Sessions live in easleydunn.session (see sql/001_create_session_table.sql).
 * The cookie holds only an opaque id, so everything here operates on the
 * server-side row — which is what makes logout and revocation actually end a
 * session rather than just deleting the client's copy.
 */

"use strict";

const { getPool } = require("../db/database");
const dbConfig = require("../config/db.config");
const appConfig = require("../config/app.config");

const SESSION_TABLE = `"${dbConfig.schema}"."session"`;

/**
 * Starts an authenticated session for a user.
 *
 * Regenerates the session id first — without this, an id an attacker planted
 * before login would survive authentication (session fixation).
 *
 * @param {import("express").Request} req
 * @param {number} userId
 * @returns {Promise<void>}
 */
function establishSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenErr) => {
      if (regenErr) return reject(regenErr);

      req.session.userId = userId;
      req.session.createdAt = Date.now();

      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

/**
 * Ends the current session: deletes the server-side row, then clears the cookie.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
function destroySession(req, res) {
  return new Promise((resolve, reject) => {
    const finish = () => {
      res.clearCookie(appConfig.sessionCookieName, {
        httpOnly: true,
        secure: appConfig.sessionSecureCookie,
        sameSite: appConfig.sessionSameSite,
        path: "/",
      });
      resolve();
    };

    if (!req.session) return finish();
    req.session.destroy((err) => (err ? reject(err) : finish()));
  });
}

/**
 * Deletes every session belonging to a user. Called when console access is
 * revoked, when an account is deactivated, and on password change.
 *
 * Uses the idx_session_user expression index.
 *
 * @param {number|string} userId
 * @returns {Promise<number>} rows deleted
 */
async function revokeAllForUser(userId) {
  const { rowCount } = await getPool().query(
    `DELETE FROM ${SESSION_TABLE} WHERE sess->>'userId' = $1`,
    [String(userId)]
  );
  return rowCount;
}

/**
 * Lists a user's live sessions. Intended for an admin "active sessions" view.
 * @param {number|string} userId
 */
async function listForUser(userId) {
  const { rows } = await getPool().query(
    `SELECT sid, sess->>'createdAt' AS created_at, expire
       FROM ${SESSION_TABLE}
      WHERE sess->>'userId' = $1
      ORDER BY expire DESC`,
    [String(userId)]
  );
  return rows;
}

/**
 * Absolute-timeout check. express-session enforces the idle window via the
 * cookie's maxAge and the store's expire column; it has no concept of a hard
 * cap measured from login, so that lives here.
 *
 * @param {object} session
 * @returns {boolean}
 */
function isExpiredByAbsoluteTimeout(session) {
  if (!session || !session.createdAt) return true;
  return Date.now() - session.createdAt > appConfig.sessionAbsoluteMs;
}

module.exports = {
  establishSession,
  destroySession,
  revokeAllForUser,
  listForUser,
  isExpiredByAbsoluteTimeout,
};
