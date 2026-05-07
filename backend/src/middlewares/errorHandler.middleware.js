/**
 * @file errorHandler.middleware.js
 * @description Global Express error-handling middleware.
 *
 * Must be the LAST middleware registered in app.js.
 * Handles both operational ApiErrors and unexpected programmer errors.
 */

"use strict";

const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

/**
 * @param {Error} err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Normalise non-ApiError throws into a 500
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational !== false;

  if (!isOperational || statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} — ${err.message}`, {
      stack: err.stack,
    });
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} — ${err.message}`);
  }

  // Never expose stack traces to clients in production
  const isDev = (process.env.NODE_ENV || "development") === "development";

  res.status(statusCode).json({
    success: false,
    statusCode,
    message: err.message || "Internal Server Error",
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = errorHandler;
