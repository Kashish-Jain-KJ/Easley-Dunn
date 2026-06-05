/**
 * @file server.js
 * @description HTTP server bootstrap.
 *
 * 1. Loads environment variables from .env
 * 2. Verifies the database connection
 * 3. Starts the Express server
 * 4. Handles SIGTERM / SIGINT for graceful shutdown
 */

"use strict";

// Load .env BEFORE any config file is required
require("dotenv").config();

const app = require("./src/app");
const appConfig = require("./src/config/app.config");
const { testConnection } = require("./src/db/database");
const logger = require("./src/utils/logger");

// ─── Bootstrap ────────────────────────────────────────────────────────────────
(async () => {
  try {
    // Verify DB before accepting traffic
    await testConnection();

    const server = app.listen(appConfig.port, () => {
      logger.info(
        `🚀  Server running in ${appConfig.nodeEnv} mode on port ${appConfig.port}`
      );
      logger.info(`📡  API available at ${appConfig.apiUrl}`);
    });

    // ─── Graceful shutdown ──────────────────────────────────────────────────
    const shutdown = (signal) => {
      logger.info(`${signal} received — shutting down gracefully…`);
      server.close(() => {
        logger.info("HTTP server closed.");
        process.exit(0);
      });

      // Force-kill if server takes more than 10 s to drain
      setTimeout(() => {
        logger.error("Forced shutdown after timeout.");
        process.exit(1);
      }, 10_000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Catch unhandled promise rejections / exceptions and log them
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled Rejection:", reason);
    });

    process.on("uncaughtException", (err) => {
      logger.error("Uncaught Exception:", err);
      process.exit(1);
    });
  } catch (err) {
    logger.error("❌  Failed to start server:", err);
    process.exit(1);
  }
})();
