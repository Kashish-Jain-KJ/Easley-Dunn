/**
 * @file services.test.js
 * @description Integration tests for services endpoints.
 */

"use strict";

require("dotenv").config();

const request = require("supertest");
const app = require("../../src/app");
const { getPool } = require("../../src/db/database");

// Stub the session lookup — these tests exercise route wiring and controller
// behaviour, not authentication. See tests/helpers/authMock.js.
jest.mock("../../src/middlewares/requireAuth.middleware", () =>
  jest.fn((req, _res, next) => {
    req.user = require("../helpers/authMock").TEST_USER;
    next();
  })
);





describe("Services Routes Integration Tests", () => {
  describe("GET /services", () => {
    it("should return all services in the database", async () => {
      const res = await request(app)
        .get("/services");
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
