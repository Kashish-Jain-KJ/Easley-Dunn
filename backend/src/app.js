/**
 * @file app.js
 * @description Express application factory.
 *
 * Kept separate from server.js so the app instance can be imported
 * in integration tests without starting the HTTP listener.
 */

"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const appConfig = require("./config/app.config");
const logger = require("./utils/logger");
const indexRouter = require("./routes/index.routes");
const notFound = require("./middlewares/notFound.middleware");
const errorHandler = require("./middlewares/errorHandler.middleware");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger.config");

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: appConfig.corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: appConfig.rateLimitWindowMs,
    max: appConfig.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later." },
  })
);

// ─── Request parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── HTTP request logging ─────────────────────────────────────────────────────
const morganStream = { write: (msg) => logger.http(msg.trim()) };
app.use(
  morgan(appConfig.nodeEnv === "production" ? "combined" : "dev", {
    stream: morganStream,
  })
);

// ─── Root redirect → Swagger UI ──────────────────────────────────────────────
app.get("/", (_req, res) => res.redirect("/docs"));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/", indexRouter);

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ─── 404 & Error handling (must be last) ─────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
