/**
 * @file services.test.js
 * @description Integration tests for services endpoints.
 */

"use strict";

require("dotenv").config();

const request = require("supertest");
const app = require("../../src/app");
const { getPool } = require("../../src/db/database");

describe("Services Routes Integration Tests", () => {
  describe("GET /services", () => {
    it("should return all services in the database", async () => {
      const res = await request(app).get("/services");
      const dbRes = await getPool().query("SELECT * FROM user_service_access");
      console.log("USER SERVICE ACCESS ROWS:", dbRes.rows);
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

  describe("GET /services/:serviceId/commands", () => {
    it("should return 404 for a non-existent service ID", async () => {
      const res = await request(app).get("/services/99999/commands");
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 200 and commands list if service exists", async () => {
      // Find an existing service ID from database first
      const { rows } = await getPool().query("SELECT service_id FROM services LIMIT 1");
      if (rows.length > 0) {
        const serviceId = rows[0].service_id;
        const res = await request(app).get(`/services/${serviceId}/commands`);
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.serviceId.toString()).toBe(serviceId.toString());
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });
  });
});
