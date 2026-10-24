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
const sessionMiddleware = require("./config/session.config");

const app = express();

// Required behind a load balancer or reverse proxy: without it Express sees
// the proxy's IP (breaking per-IP rate limiting) and refuses to set Secure
// cookies because it believes the connection is plaintext.
app.set("trust proxy", 1);

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());

// Nothing this API returns may be kept by the browser. Without an explicit
// rule a browser may cache a response on its own, and a back-navigation
// repaints what it already holds rather than asking again — so data fetched
// for one session can reappear on screen after that session has ended, with
// the server never getting the chance to refuse it. On a shared machine that
// is the next person reading the last person's console. helmet does not set
// this (it dropped its no-cache default in v4), so it is set here.
app.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

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
// Three budgets, all per IP. Guessing passwords is the attack worth throttling
// hard; an admin clicking around the console is not, and a single limit low
// enough for the first locks the second out.
app.use(
  "/auth/login",
  rateLimit({
    windowMs: appConfig.loginRateLimitWindowMs,
    max: appConfig.loginRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { success: false, message: "Too many sign-in attempts, please try again later." },
  })
);

// Asking for a reset link is unauthenticated and sends an email to an address
// the caller chose, so it is both a way to spam someone else's mailbox and the
// slowest part of the request. Successful calls are counted, unlike sign-in:
// here "successful" says nothing about whether the address was real, so there
// is nothing to reward.
app.use(
  "/auth/forgot-password",
  rateLimit({
    windowMs: appConfig.loginRateLimitWindowMs,
    max: appConfig.loginRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many reset requests, please try again later." },
  })
);

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

// ─── Session ──────────────────────────────────────────────────────────────────
// Must come before any router so req.session exists for requireAuth.
app.use(sessionMiddleware);

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
