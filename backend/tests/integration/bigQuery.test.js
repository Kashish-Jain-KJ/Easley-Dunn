/**
 * @file bigQuery.test.js
 * @description Integration tests for the BigQuery onboarding and offboarding endpoints.
 */

"use strict";

require("dotenv").config();

const request = require("supertest");
const app = require("../../src/app");
const { getPool } = require("../../src/db/database");
const { google } = require("googleapis");

// Mock the googleapis cloudresourcemanager
jest.mock("googleapis", () => {
  const original = jest.requireActual("googleapis");
  const mockGetIamPolicy = jest.fn();
  const mockSetIamPolicy = jest.fn();
  
  return {
    ...original,
    google: {
      ...original.google,
      auth: {
        GoogleAuth: jest.fn().mockImplementation(() => {
          return {
            getClient: jest.fn().mockResolvedValue({}),
          };
        }),
      },
      cloudresourcemanager: jest.fn().mockImplementation(() => {
        return {
          projects: {
            getIamPolicy: mockGetIamPolicy,
            setIamPolicy: mockSetIamPolicy,
          },
        };
      }),
    },
  };
});

describe("BigQuery Endpoints", () => {
  let mockGetIamPolicy;
  let mockSetIamPolicy;

  beforeEach(() => {
    jest.clearAllMocks();
    const crm = google.cloudresourcemanager();
    mockGetIamPolicy = crm.projects.getIamPolicy;
    mockSetIamPolicy = crm.projects.setIamPolicy;
  });

  describe("POST /bigquery/users/:userId", () => {
    it("should return 404 if no inactive access record is found", async () => {
      const pool = getPool();
      const originalQuery = pool.query;
      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services")) {
          return Promise.resolve({ rows: [{ service_id: 3 }] });
        }
        if (text.includes("SELECT usa.access_id")) {
          return Promise.resolve({ rows: [] }); // No inactive record
        }
        if (text.includes("INSERT INTO log")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app)
          .post("/bigquery/users/1")
          .send({});

        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/No inactive BigQuery access records found/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should onboard user access and update database if credentials and record exist", async () => {
      // Mock IAM Policy
      mockGetIamPolicy.mockResolvedValue({
        data: {
          bindings: [
            {
              role: "roles/viewer",
              members: ["user:other-user@example.com"],
            },
          ],
        },
      });
      mockSetIamPolicy.mockResolvedValue({ data: {} });

      const pool = getPool();
      const originalQuery = pool.query;
      let updatedDb = false;
      let loggedSuccess = false;

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services")) {
          return Promise.resolve({ rows: [{ service_id: 3 }] });
        }
        if (text.includes("SELECT usa.access_id")) {
          return Promise.resolve({
            rows: [
              {
                access_id: "4",
                external_account_identifier: "assignment4server-422111",
                external_user_identifier: "kashishjain041@gmail.com",
                role_name: "roles/bigquery.admin",
                service_id: "3",
              },
            ],
          });
        }
        if (text.includes("UPDATE user_service_access")) {
          updatedDb = true;
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO log")) {
          loggedSuccess = true;
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      // Mock fs.existsSync to simulate credentials exist
      const fs = require("fs");
      const originalExistsSync = fs.existsSync;
      const originalLstatSync = fs.lstatSync;
      const originalReaddirSync = fs.readdirSync;

      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.lstatSync = jest.fn().mockReturnValue({ isDirectory: () => true });
      fs.readdirSync = jest.fn().mockReturnValue(["credentials.json"]);

      try {
        const res = await request(app)
          .post("/bigquery/users/1")
          .send({});

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/Successfully onboarded user to 1 BigQuery project/i);
        expect(updatedDb).toBe(true);
        expect(loggedSuccess).toBe(true);
        expect(mockSetIamPolicy).toHaveBeenCalledTimes(1);

        // Check if role binding was correctly updated
        const setIamPolicyCall = mockSetIamPolicy.mock.calls[0][0];
        expect(setIamPolicyCall.resource).toBe("projects/assignment4server-422111");
        const policyBindings = setIamPolicyCall.requestBody.policy.bindings;
        const viewerBinding = policyBindings.find(b => b.role === "roles/viewer");
        expect(viewerBinding.members).toContain("user:kashishjain041@gmail.com");
      } finally {
        pool.query = originalQuery;
        fs.existsSync = originalExistsSync;
        fs.lstatSync = originalLstatSync;
        fs.readdirSync = originalReaddirSync;
      }
    });
  });

  describe("DELETE /bigquery/users/:userId", () => {
    it("should return 404 if BigQuery access record is not found", async () => {
      const pool = getPool();
      const originalQuery = pool.query;
      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services")) {
          return Promise.resolve({ rows: [{ service_id: 3 }] });
        }
        if (text.includes("SELECT usa.external_account_identifier")) {
          return Promise.resolve({ rows: [] }); // Not found
        }
        if (text.includes("INSERT INTO log")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app)
          .delete("/bigquery/users/1");

        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/BigQuery access record not found/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should remove user access and update database if credentials and record exist", async () => {
      // Mock IAM Policy
      mockGetIamPolicy.mockResolvedValue({
        data: {
          bindings: [
            {
              role: "roles/bigquery.admin",
              members: ["user:kashishjain041@gmail.com", "user:other-user@example.com"],
            },
          ],
        },
      });
      mockSetIamPolicy.mockResolvedValue({ data: {} });

      const pool = getPool();
      const originalQuery = pool.query;
      let updatedDb = false;
      let loggedSuccess = false;

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services")) {
          return Promise.resolve({ rows: [{ service_id: 3 }] });
        }
        if (text.includes("SELECT usa.external_account_identifier")) {
          return Promise.resolve({
            rows: [
              {
                external_account_identifier: "assignment4server-422111",
                external_user_identifier: "kashishjain041@gmail.com",
                role_name: "roles/bigquery.admin",
                service_id: "3",
              },
            ],
          });
        }
        if (text.includes("UPDATE user_service_access")) {
          updatedDb = true;
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO log")) {
          loggedSuccess = true;
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      // Mock fs.existsSync to simulate credentials exist
      const fs = require("fs");
      const originalExistsSync = fs.existsSync;
      const originalLstatSync = fs.lstatSync;
      const originalReaddirSync = fs.readdirSync;

      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.lstatSync = jest.fn().mockReturnValue({ isDirectory: () => true });
      fs.readdirSync = jest.fn().mockReturnValue(["credentials.json"]);

      try {
        const res = await request(app)
          .delete("/bigquery/users/1");

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/Successfully removed kashishjain041@gmail.com/i);
        expect(updatedDb).toBe(true);
        expect(loggedSuccess).toBe(true);
        expect(mockSetIamPolicy).toHaveBeenCalledTimes(1);

        // Check if role binding was correctly updated (user removed)
        const setIamPolicyCall = mockSetIamPolicy.mock.calls[0][0];
        expect(setIamPolicyCall.resource).toBe("projects/assignment4server-422111");
        const policyBindings = setIamPolicyCall.requestBody.policy.bindings;
        const adminBinding = policyBindings.find(b => b.role === "roles/bigquery.admin");
        expect(adminBinding.members).not.toContain("user:kashishjain041@gmail.com");
        expect(adminBinding.members).toContain("user:other-user@example.com");
      } finally {
        pool.query = originalQuery;
        fs.existsSync = originalExistsSync;
        fs.lstatSync = originalLstatSync;
        fs.readdirSync = originalReaddirSync;
      }
    });
  });
});
