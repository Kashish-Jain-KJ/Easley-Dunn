/**
 * @file discord.test.js
 * @description Integration tests for Discord onboarding/offboarding/confirm endpoints.
 * Mocks global.fetch (Discord REST calls), nodemailer (invite emails), and pool.query
 * (DB) — no real Discord server, SMTP account, or database is touched.
 */

"use strict";

require("dotenv").config();

const request = require("supertest");
const app = require("../../src/app");
const { getPool } = require("../../src/db/database");

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(),
}));

const nodemailer = require("nodemailer");

describe("Discord integration", () => {
  const ENV_KEYS = ["DISCORD_BOT_TOKEN", "DISCORD_INVITE_CHANNEL_ID", "DISCORD_GUILD_ID", "MAIL_FROM", "MAIL_SMTP_USERNAME"];
  let originalEnv = {};
  let mockSendMail;

  beforeAll(() => {
    ENV_KEYS.forEach((k) => {
      originalEnv[k] = process.env[k];
    });
    process.env.DISCORD_BOT_TOKEN = "mock-bot-token";
    process.env.DISCORD_INVITE_CHANNEL_ID = "channel-123";
    process.env.DISCORD_GUILD_ID = "guild-456";
    process.env.MAIL_FROM = "noreply@easleydunnproductions.com";
    process.env.MAIL_SMTP_USERNAME = "noreply@easleydunnproductions.com";
  });

  afterAll(() => {
    ENV_KEYS.forEach((k) => {
      process.env[k] = originalEnv[k];
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockSendMail = jest.fn().mockResolvedValue({});
    nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail });
  });

  describe("POST /discord/users/:userId", () => {
    it("should return 400 if userId is not an integer", async () => {
      const res = await request(app).post("/discord/users/abc").send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/userId must be an integer/i);
    });

    it("should return 404 if the DISCORD service row does not exist", async () => {
      const pool = getPool();
      const originalQuery = pool.query;
      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/42").send({});

        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/DISCORD service row not found/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should return 404 and log a failure if the user is not found locally", async () => {
      const pool = getPool();
      const originalQuery = pool.query;
      let loggedFailure = false;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("FROM users WHERE user_id")) {
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO log")) {
          loggedFailure = text.includes("'FAILED'");
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/999").send({});

        expect(res.statusCode).toBe(404);
        expect(res.body.message).toMatch(/User not found/i);
        expect(loggedFailure).toBe(true);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should return 404 if there is no access row and no guild fallback configured", async () => {
      const originalGuildId = process.env.DISCORD_GUILD_ID;
      process.env.DISCORD_GUILD_ID = "";

      const pool = getPool();
      const originalQuery = pool.query;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("FROM users WHERE user_id")) {
          return Promise.resolve({ rows: [{ user_id: 42, email: "new-hire@example.com", name: "New Hire" }] });
        }
        if (text.includes("usa.is_active = false")) {
          return Promise.resolve({ rows: [] }); // no existing inactive row
        }
        if (text.includes("external_account_identifier IS NOT NULL")) {
          return Promise.resolve({ rows: [] }); // no fallback guild in DB either
        }
        if (text.includes("INSERT INTO log")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/42").send({});

        expect(res.statusCode).toBe(404);
        expect(res.body.message).toMatch(/No inactive Discord access records/i);
      } finally {
        pool.query = originalQuery;
        process.env.DISCORD_GUILD_ID = originalGuildId;
      }
    });

    it("should auto-create an access row, generate an invite, email it, and log success", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ code: "abc123" })),
      });

      const pool = getPool();
      const originalQuery = pool.query;
      let accessInserted = false;
      let accessActivated = false;
      let successLogged = false;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("FROM users WHERE user_id")) {
          return Promise.resolve({ rows: [{ user_id: 42, email: "new-hire@example.com", name: "New Hire" }] });
        }
        if (text.includes("usa.is_active = false")) {
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO user_service_access")) {
          accessInserted = true;
          return Promise.resolve({
            rows: [{ access_id: 200, external_account_identifier: "guild-456", external_user_identifier: null, service_id: 11 }],
          });
        }
        if (text.includes("SET is_active = true")) {
          accessActivated = true;
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO log")) {
          successLogged = text.includes("'SUCCESS'");
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/42").send({});

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data[0].inviteUrl).toBe("https://discord.gg/abc123");
        expect(res.body.data[0].emailSent).toBe(true);
        expect(accessInserted).toBe(true);
        expect(accessActivated).toBe(true);
        expect(successLogged).toBe(true);
        expect(mockSendMail).toHaveBeenCalledTimes(1);
        expect(mockSendMail.mock.calls[0][0].to).toBe("new-hire@example.com");

        const fetchArgs = global.fetch.mock.calls[0];
        expect(fetchArgs[0]).toBe("https://discord.com/api/v10/channels/channel-123/invites");
        expect(fetchArgs[1].headers.Authorization).toBe("Bot mock-bot-token");
        const payload = JSON.parse(fetchArgs[1].body);
        expect(payload.max_uses).toBe(1);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should still onboard successfully (emailSent: false) if the email fails to send", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ code: "def456" })),
      });
      mockSendMail.mockRejectedValue(new Error("SMTP connection refused"));

      const pool = getPool();
      const originalQuery = pool.query;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("FROM users WHERE user_id")) {
          return Promise.resolve({ rows: [{ user_id: 42, email: "new-hire@example.com", name: "New Hire" }] });
        }
        if (text.includes("usa.is_active = false")) {
          return Promise.resolve({
            rows: [{ access_id: 201, external_account_identifier: "guild-456", external_user_identifier: null, service_id: 11 }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/42").send({});

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data[0].emailSent).toBe(false);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should fail a row missing DISCORD_INVITE_CHANNEL_ID and return 500 overall", async () => {
      const originalChannelId = process.env.DISCORD_INVITE_CHANNEL_ID;
      process.env.DISCORD_INVITE_CHANNEL_ID = "";

      const pool = getPool();
      const originalQuery = pool.query;
      let failureLogged = false;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("FROM users WHERE user_id")) {
          return Promise.resolve({ rows: [{ user_id: 42, email: "new-hire@example.com", name: "New Hire" }] });
        }
        if (text.includes("usa.is_active = false")) {
          return Promise.resolve({
            rows: [{ access_id: 202, external_account_identifier: "guild-456", external_user_identifier: null, service_id: 11 }],
          });
        }
        if (text.includes("INSERT INTO log")) {
          failureLogged = text.includes("'FAILED'");
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/42").send({});

        expect(res.statusCode).toBe(500);
        expect(res.body.message).toMatch(/Failed to generate a Discord invite/i);
        expect(failureLogged).toBe(true);
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        pool.query = originalQuery;
        process.env.DISCORD_INVITE_CHANNEL_ID = originalChannelId;
      }
    });

    it("should handle a Discord API error during invite creation and return 500", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({ message: "Missing Permissions", code: 50013 })),
      });

      const pool = getPool();
      const originalQuery = pool.query;
      let loggedErrorMessage = "";

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("FROM users WHERE user_id")) {
          return Promise.resolve({ rows: [{ user_id: 42, email: "new-hire@example.com", name: "New Hire" }] });
        }
        if (text.includes("usa.is_active = false")) {
          return Promise.resolve({
            rows: [{ access_id: 203, external_account_identifier: "guild-456", external_user_identifier: null, service_id: 11 }],
          });
        }
        if (text.includes("INSERT INTO log")) {
          loggedErrorMessage = params[2] || "";
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/42").send({});

        expect(res.statusCode).toBe(500);
        expect(res.body.data[0].status).toBe("failed");
        expect(loggedErrorMessage).toContain("Missing Permissions");
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe("DELETE /discord/users/:userId", () => {
    it("should return 400 if userId is not an integer", async () => {
      const res = await request(app).delete("/discord/users/abc").send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/userId must be an integer/i);
    });

    it("should return 404 and log a failure if no active access record exists", async () => {
      const pool = getPool();
      const originalQuery = pool.query;
      let loggedFailure = false;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("usa.is_active = true")) {
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO log")) {
          loggedFailure = text.includes("'FAILED'");
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).delete("/discord/users/42").send({});

        expect(res.statusCode).toBe(404);
        expect(res.body.message).toMatch(/No active Discord access record/i);
        expect(loggedFailure).toBe(true);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should fail and return 500 if the access row is missing guild/user IDs", async () => {
      const pool = getPool();
      const originalQuery = pool.query;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("usa.is_active = true")) {
          return Promise.resolve({
            rows: [{ access_id: 300, external_account_identifier: "guild-456", external_user_identifier: null, service_id: 11 }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).delete("/discord/users/42").send({});

        expect(res.statusCode).toBe(500);
        expect(res.body.message).toMatch(/Failed to kick user/i);
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should successfully kick the user, update the DB, and log success", async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 204 });

      const pool = getPool();
      const originalQuery = pool.query;
      let accessDeactivated = false;
      let successLogged = false;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("usa.is_active = true")) {
          return Promise.resolve({
            rows: [{ access_id: 301, external_account_identifier: "guild-456", external_user_identifier: "discord-user-999", service_id: 11 }],
          });
        }
        if (text.includes("SET is_active = false")) {
          accessDeactivated = true;
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO log")) {
          successLogged = text.includes("'SUCCESS'");
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).delete("/discord/users/42").send({});

        expect(res.statusCode).toBe(200);
        expect(res.body.data[0].status).toBe("kicked");
        expect(accessDeactivated).toBe(true);
        expect(successLogged).toBe(true);

        const fetchArgs = global.fetch.mock.calls[0];
        expect(fetchArgs[0]).toBe("https://discord.com/api/v10/guilds/guild-456/members/discord-user-999");
        expect(fetchArgs[1].method).toBe("DELETE");
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should handle a Discord API error on kick and return 500", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ message: "Unknown Member", code: 10007 })),
      });

      const pool = getPool();
      const originalQuery = pool.query;
      let loggedErrorMessage = "";

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("usa.is_active = true")) {
          return Promise.resolve({
            rows: [{ access_id: 302, external_account_identifier: "guild-456", external_user_identifier: "discord-user-999", service_id: 11 }],
          });
        }
        if (text.includes("INSERT INTO log")) {
          loggedErrorMessage = params[2] || "";
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).delete("/discord/users/42").send({});

        expect(res.statusCode).toBe(500);
        expect(loggedErrorMessage).toContain("Unknown Member");
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe("POST /discord/users/:userId/confirm", () => {
    it("should return 400 if userId is not an integer", async () => {
      const res = await request(app).post("/discord/users/abc/confirm").send({ username: "someone" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/userId must be an integer/i);
    });

    it("should return 400 if username is missing", async () => {
      const res = await request(app).post("/discord/users/42/confirm").send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/username is required/i);
    });

    it("should return 404 if no Discord access record exists for this user", async () => {
      const pool = getPool();
      const originalQuery = pool.query;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("ORDER BY usa.last_synced_at")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/42/confirm").send({ username: "someone" });

        expect(res.statusCode).toBe(404);
        expect(res.body.message).toMatch(/No Discord access record found/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should return 400 if the access record has no guild ID", async () => {
      const pool = getPool();
      const originalQuery = pool.query;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("ORDER BY usa.last_synced_at")) {
          return Promise.resolve({ rows: [{ access_id: 400, external_account_identifier: null }] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/42/confirm").send({ username: "someone" });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/Missing Discord guild ID/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should resolve an exact username match and record the Discord user ID", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify([
              { user: { id: "discord-user-111", username: "someoneelse" } },
              { user: { id: "discord-user-222", username: "someone" } },
            ])
          ),
      });

      const pool = getPool();
      const originalQuery = pool.query;
      let identifierUpdated = false;
      let updatedWith = null;
      let successLogged = false;

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("ORDER BY usa.last_synced_at")) {
          return Promise.resolve({ rows: [{ access_id: 401, external_account_identifier: "guild-456" }] });
        }
        if (text.includes("SET external_user_identifier")) {
          identifierUpdated = true;
          updatedWith = params[0];
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO log")) {
          successLogged = text.includes("'SUCCESS'");
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/42/confirm").send({ username: "someone" });

        expect(res.statusCode).toBe(200);
        expect(res.body.discordUserId).toBe("discord-user-222");
        expect(identifierUpdated).toBe(true);
        expect(updatedWith).toBe("discord-user-222");
        expect(successLogged).toBe(true);

        const fetchArgs = global.fetch.mock.calls[0];
        expect(fetchArgs[0]).toBe("https://discord.com/api/v10/guilds/guild-456/members/search?query=someone&limit=5");
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should fall back to the first result when no exact username match exists", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify([{ user: { id: "discord-user-333", username: "someone-prefixed" } }])
          ),
      });

      const pool = getPool();
      const originalQuery = pool.query;

      pool.query = jest.fn().mockImplementation((text) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("ORDER BY usa.last_synced_at")) {
          return Promise.resolve({ rows: [{ access_id: 402, external_account_identifier: "guild-456" }] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/42/confirm").send({ username: "someone" });

        expect(res.statusCode).toBe(200);
        expect(res.body.discordUserId).toBe("discord-user-333");
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should return 500 and log a failure when no Discord member matches", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify([])),
      });

      const pool = getPool();
      const originalQuery = pool.query;
      let loggedErrorMessage = "";

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services WHERE service_code")) {
          return Promise.resolve({ rows: [{ service_id: 11 }] });
        }
        if (text.includes("ORDER BY usa.last_synced_at")) {
          return Promise.resolve({ rows: [{ access_id: 403, external_account_identifier: "guild-456" }] });
        }
        if (text.includes("INSERT INTO log")) {
          loggedErrorMessage = params[2] || "";
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app).post("/discord/users/42/confirm").send({ username: "nobody" });

        expect(res.statusCode).toBe(500);
        expect(res.body.message).toMatch(/Failed to confirm Discord username/i);
        expect(loggedErrorMessage).toContain("No Discord member found");
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe("GET /discord/users/:userId/confirm-page", () => {
    it("should return 400 for an invalid userId", async () => {
      const res = await request(app).get("/discord/users/abc/confirm-page");

      expect(res.statusCode).toBe(400);
      expect(res.headers["content-type"]).toMatch(/html/);
      expect(res.text).toMatch(/userId must be an integer/i);
    });

    it("should return an HTML form that posts to the confirm endpoint", async () => {
      const res = await request(app).get("/discord/users/42/confirm-page");

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/html/);
      expect(res.text).toContain('<form method="POST" action="/discord/users/42/confirm">');
      expect(res.text).toContain('name="username"');
    });
  });
});
