/**
 * @file app.config.js
 * @description Application-level configuration (server, CORS, rate-limiting, etc.).
 *
 * Team members: copy .env.example → .env and customise values.
 */

"use strict";

const appConfig = {
  // HTTP server
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",

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
};

module.exports = appConfig;
