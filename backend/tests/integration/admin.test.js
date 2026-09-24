/**
 * @file admin.test.js
 * @description Integration tests for the Cerberus admin login endpoints
 * (invite, magic-link login, me, logout), plus a regression check confirming
 * this Part A change doesn't affect any existing unauthenticated route.
 *
 * Mocks pool.query and the shared mail.js transporter — no real database or
 * SMTP connection needed. Uses the real jsonwebtoken library with a fixed
 * test secret (fast, deterministic, no mocking needed for JWT itself).
 */

"use strict";

require("dotenv").config();

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const { getPool } = require("../../src/db/database");

jest.mock("../../src/utils/mail", () => ({
  getMailTransporter: jest.fn(),
}));

const { getMailTransporter } = require("../../src/utils/mail");

const TEST_SECRET = "test-secret-for-admin-jwt";

function makeSessionCookie({ userId = 1, email = "admin@example.com", role = "ADMIN" } = {}) {
  const token = jwt.sign({ userId, email, role }, TEST_SECRET, { expiresIn: "7d" });
  return `session=${token}`;
}

describe("Cerberus admin login", () => {
  let originalSecret;
  let mockSendMail;

  beforeAll(() => {
    originalSecret = process.env.AUTH_JWT_SECRET;
    process.env.AUTH_JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    process.env.AUTH_JWT_SECRET = originalSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail = jest.fn().mockResolvedValue({});
    getMailTransporter.mockReturnValue({ sendMail: mockSendMail });
  });

  describe("POST /admin/invite", () => {
    it("should return 401 with no session cookie", async () => {
      const res = await request(app).post("/admin/invite").send({ email: "x@example.com", role: "DEV" });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/not logged in/i);
    });

    it("should return 403 when the caller is not an ADMIN", async () => {
      const res = await request(app)
        .post("/admin/invite")
        .set("Cookie", makeSessionCookie({ role: "DEV" }))
        .send({ email: "x@example.com", role: "DEV" });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/only an admin/i);
    });

    it("should return 400 if email is missing", async () => {
      const res = await request(app)
        .post("/admin/invite")
        .set("Cookie", makeSessionCookie())
        .send({ role: "DEV" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/email is required/i);
    });

    it("should return 400 if role is invalid", async () => {
      const res = await request(app)
        .post("/admin/invite")
        .set("Cookie", makeSessionCookie())
        .send({ email: "x@example.com", role: "OWNER" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/role must be one of/i);
    });

    it("should create a new user, insert a token, and email the link", async () => {
      const pool = getPool();
      const originalQuery = pool.query;
      let insertedUserRole = null;
      let tokenInserted = false;

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT user_id FROM easleydunn.users WHERE email")) {
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO easleydunn.users")) {
          insertedUserRole = params[3];
          return Promise.resolve({ rows: [{ user_id: 42 }] });
        }
        if (text.includes("INSERT INTO cerberus_admin_tokens")) {
          tokenInserted = true;
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app)
          .post("/admin/invite")
          .set("Cookie", makeSessionCookie())
          .send({ email: "newdev@example.com", name: "New Dev", role: "dev" });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.emailSent).toBe(true);
        expect(insertedUserRole).toBe("DEV");
        expect(tokenInserted).toBe(true);
        expect(mockSendMail).toHaveBeenCalledTimes(1);
        expect(mockSendMail.mock.calls[0][0].to).toBe("newdev@example.com");
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should update role on an existing user instead of creating a duplicate", async () => {
      const pool = getPool();
      const originalQuery = pool.query;
      let roleUpdated = false;

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT user_id FROM easleydunn.users WHERE email")) {
          return Promise.resolve({ rows: [{ user_id: 7 }] });
        }
        if (text.includes('UPDATE easleydunn.users SET "Role"')) {
          roleUpdated = params[0] === "ADMIN";
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO cerberus_admin_tokens")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app)
          .post("/admin/invite")
          .set("Cookie", makeSessionCookie())
          .send({ email: "existing@example.com", role: "admin" });

        expect(res.statusCode).toBe(201);
        expect(roleUpdated).toBe(true);
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe("GET /admin/login", () => {
    it("should return 400 if token is missing", async () => {
      const res = await request(app).get("/admin/login");

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/token is required/i);
    });

    it("should return 401 for a token that doesn't exist", async () => {
      const pool = getPool();
      const originalQuery = pool.query;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("FROM cerberus_admin_tokens")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).get("/admin/login?token=nonexistent");

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/invalid login link/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should return 401 for an already-used token", async () => {
      const pool = getPool();
      const originalQuery = pool.query;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("FROM cerberus_admin_tokens")) {
          return Promise.resolve({
            rows: [{
              token_id: 1,
              user_id: 5,
              expires_at: new Date(Date.now() + 60_000),
              used_at: new Date(),
              email: "a@example.com",
              Role: "DEV",
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).get("/admin/login?token=usedtoken");

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/already been used/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should return 401 for an expired token", async () => {
      const pool = getPool();
      const originalQuery = pool.query;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("FROM cerberus_admin_tokens")) {
          return Promise.resolve({
            rows: [{
              token_id: 2,
              user_id: 5,
              expires_at: new Date(Date.now() - 60_000),
              used_at: null,
              email: "a@example.com",
              Role: "DEV",
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).get("/admin/login?token=expiredtoken");

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/expired/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should mark a valid token used, update last_login_at, and set a session cookie", async () => {
      const pool = getPool();
      const originalQuery = pool.query;
      let tokenMarkedUsed = false;
      let lastLoginUpdated = false;

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("FROM cerberus_admin_tokens")) {
          return Promise.resolve({
            rows: [{
              token_id: 3,
              user_id: 9,
              expires_at: new Date(Date.now() + 60_000),
              used_at: null,
              email: "valid@example.com",
              Role: "ADMIN",
            }],
          });
        }
        if (text.includes("SET used_at = NOW()")) {
          tokenMarkedUsed = params[0] === 3;
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("SET last_login_at = NOW()")) {
          lastLoginUpdated = params[0] === 9;
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).get("/admin/login?token=validtoken");

        expect(res.statusCode).toBe(302);
        expect(tokenMarkedUsed).toBe(true);
        expect(lastLoginUpdated).toBe(true);

        const setCookieHeader = res.headers["set-cookie"];
        expect(setCookieHeader).toBeDefined();
        expect(setCookieHeader[0]).toMatch(/^session=/);
        expect(setCookieHeader[0]).toMatch(/HttpOnly/i);
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe("GET /admin/me", () => {
    it("should return 401 with no session cookie", async () => {
      const res = await request(app).get("/admin/me");
      expect(res.statusCode).toBe(401);
    });

    it("should return the session identity with a valid cookie", async () => {
      const res = await request(app)
        .get("/admin/me")
        .set("Cookie", makeSessionCookie({ userId: 3, email: "dev@example.com", role: "DEV" }));

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ success: true, userId: 3, email: "dev@example.com", role: "DEV" });
    });
  });

  describe("POST /admin/logout", () => {
    it("should return 401 with no session cookie", async () => {
      const res = await request(app).post("/admin/logout");
      expect(res.statusCode).toBe(401);
    });

    it("should clear the session cookie with a valid session", async () => {
      const res = await request(app)
        .post("/admin/logout")
        .set("Cookie", makeSessionCookie());

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const setCookieHeader = res.headers["set-cookie"];
      expect(setCookieHeader?.[0]).toMatch(/^session=;/);
    });
  });

  describe("Regression — existing routes stay unauthenticated", () => {
    it("GET /health should still work with zero cookie", async () => {
      const res = await request(app).get("/health");
      expect(res.statusCode).toBe(200);
    });
  });
});
