/**
 * @file services.test.js
 * @description Integration tests for services endpoints.
 */

"use strict";

require("dotenv").config();

const request = require("supertest");
const app = require("../../src/app");
const { getPool } = require("../../src/db/database");

const jwt = require("jsonwebtoken");

const TEST_SECRET = process.env.AUTH_JWT_SECRET || "test-secret-for-admin-jwt";

function makeSessionCookie({ userId = 1, email = "operator@example.com", role = "OPERATOR" } = {}) {
  const token = jwt.sign({ userId, email, role }, TEST_SECRET, { expiresIn: "7d" });
  return `session=${token}`;
}

describe("Services Routes Integration Tests", () => {
  describe("GET /services", () => {
    it("should return all services in the database", async () => {
      const res = await request(app)
        .get("/services")
        .set("Cookie", makeSessionCookie());
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("count");
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.count > 0) {
        const first = res.body.data[0];
        expect(first).toHaveProperty("service_id");
        expect(first).toHaveProperty("service_name");
        expect(first).toHaveProperty("service_code");
        expect(first).toHaveProperty("is_active");
      }
    });
  });
});
