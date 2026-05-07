/**
 * @file logger.js
 * @description Centralised Winston logger.
 *
 * - Console output with colours in development.
 * - JSON log files in production (logs/combined.log, logs/error.log).
 */

"use strict";

const { createLogger, format, transports } = require("winston");
const path = require("path");

const { combine, timestamp, colorize, printf, json, errors } = format;

const isDev = (process.env.NODE_ENV || "development") === "development";

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) =>
    stack
      ? `[${timestamp}] ${level}: ${message}\n${stack}`
      : `[${timestamp}] ${level}: ${message}`
  )
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: isDev ? devFormat : prodFormat,
  transports: [
    new transports.Console(),
    ...(isDev
      ? []
      : [
          new transports.File({
            filename: path.join("logs", "error.log"),
            level: "error",
          }),
          new transports.File({
            filename: path.join("logs", "combined.log"),
          }),
        ]),
  ],
  exitOnError: false,
});

module.exports = logger;
