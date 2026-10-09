/**
 * @file session.config.js
 * @description express-session middleware, backed by PostgreSQL.
 *
 * Replaces the previous stateless-JWT scheme. The cookie now carries an opaque,
 * random session id and nothing else — no identity, no role. Authority is read
 * from the database on each request (see requireAuth.middleware.js), which is
 * what makes revocation immediate.
 *
 * Table: easleydunn.session — see sql/001_create_session_table.sql.
 */

"use strict";

const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");

const { getPool } = require("../db/database");
const dbConfig = require("./db.config");
const appConfig = require("./app.config");

const PgSession = connectPgSimple(session);

const sessionMiddleware = session({
  // Not the default "connect.sid" — no need to advertise the stack.
  name: appConfig.sessionCookieName,

  store: new PgSession({
    pool: getPool(),
    schemaName: dbConfig.schema,
    tableName: "session",
    // The table is created by sql/001_create_session_table.sql, which also adds
    // the idx_session_user index that connect-pg-simple does not know about.
    createTableIfMissing: false,
    // Seconds between sweeps for expired rows — no cron needed.
    pruneSessionInterval: 60,
  }),

  secret: appConfig.sessionSecret,
  resave: false,
  // Don't persist a row for anonymous visitors; keeps unauthenticated traffic
  // from filling the table.
  saveUninitialized: false,
  // Slide the idle window forward on each request.
  rolling: true,

  cookie: {
    httpOnly: true,
    secure: appConfig.sessionSecureCookie,
    sameSite: appConfig.sessionSameSite,
    path: "/",
    maxAge: appConfig.sessionIdleMs,
  },
});

module.exports = sessionMiddleware;
