/**
 * @file app.config.js
 * @description Application-level configuration (server, CORS, rate-limiting, session).
 *
 * Team members: copy .env.example → .env and customise values.
 *
 * Secrets are validated here, at require time, so the process cannot start in a
 * misconfigured state. There are deliberately no fallback defaults for secrets —
 * a hardcoded default that ships in the repo is not a secret.
 */

"use strict";

const nodeEnv = process.env.NODE_ENV || "development";

/**
 * Reads a required secret, failing closed if it is missing or too short.
 * @param {string} name
 * @param {number} minLength
 */
function requireSecret(name, minLength = 32) {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(
      `${name} must be set to a random string of at least ${minLength} characters. ` +
      `Generate one with: openssl rand -base64 48`
    );
  }
  return value;
}

/** Parses a positive integer env var, falling back when unset or invalid. */
function intEnv(name, fallback) {
  const parsed = parseInt(process.env[name], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const appConfig = {
  // HTTP server
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv,

  // CORS — comma-separated origins in the env var, e.g. "http://localhost:3000,https://app.easleydunn.com"
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:3000"],

  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 min
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",

  // API base URL for docs and logs
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`,

  // ─── Session ────────────────────────────────────────────────────────────────
  // Signs the session cookie. Rotating it invalidates every live session.
  sessionSecret: requireSecret("SESSION_SECRET"),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "sid",
  // Idle timeout — slides forward on each request (rolling sessions).
  sessionIdleMs: intEnv("SESSION_IDLE_MINUTES", 30) * 60 * 1000,
  // Absolute timeout — hard cap from login, regardless of activity.
  sessionAbsoluteMs: intEnv("SESSION_ABSOLUTE_HOURS", 8) * 60 * 60 * 1000,
  // "lax" works when the API and frontend are same-site (ports are ignored).
  // Cross-site deployments need "none", which also requires secure cookies and
  // makes a CSRF token mandatory.
  sessionSameSite: process.env.SESSION_SAMESITE || "lax",
  // Secure cookies everywhere except explicitly-named local environments, so an
  // unset or misspelled NODE_ENV fails closed rather than sending the cookie in
  // the clear.
  sessionSecureCookie: nodeEnv !== "development" && nodeEnv !== "test",

  // ─── Password hashing ───────────────────────────────────────────────────────
  // Server-side pepper concatenated with the password before bcrypt.
  //
  // TODO(security): this fallback is the value every existing hash was built
  // with, and it is in the repo's git history — so the pepper is public and
  // currently provides no protection. Deliberately left as-is for now; the
  // real fix is decided alongside "passwords vs SSO". If passwords stay:
  // HMAC-SHA256 the password with a real pepper before bcrypt (also fixes
  // bcrypt's 72-byte truncation dropping the pepper on long passwords), add a
  // hash_version column, and force a reset for every console user.
  passwordPepper: process.env.PASSWORD_PEPPER || "cerberus-secret-pepper-key",
};

module.exports = appConfig;
