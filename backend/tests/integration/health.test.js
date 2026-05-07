/**
 * @file health.test.js
 * @description Integration tests for the health-check endpoints.
 *
 * Run with:  npm test
 * Requires a running MySQL instance (or adjust to mock the pool).
 */

"use strict";

require("dotenv").config();

const request = require("supertest");
const app = require("../../src/app");

describe("GET /api/v1/health", () => {
  it("should return 200 and server running status", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/running/i);
  });
});

describe("GET /api/v1/health/db", () => {
  it("should return 200 and database connected", async () => {
    const res = await request(app).get("/api/v1/health/db");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.database).toBe("connected");
  });
});

describe("Unknown route", () => {
  it("should return 404 for unregistered routes", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
