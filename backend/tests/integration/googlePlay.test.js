/**
 * @file googlePlay.test.js
 * @description Integration tests for the Google Play user onboarding endpoint.
 */

"use strict";

require("dotenv").config();

const request = require("supertest");
const app = require("../../src/app");
const { getPool } = require("../../src/db/database");
const { google } = require("googleapis");

// Mock the googleapis androidpublisher
jest.mock("googleapis", () => {
  const original = jest.requireActual("googleapis");
  const mockCreate = jest.fn();
  
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
      androidpublisher: jest.fn().mockImplementation(() => {
        return {
          users: {
            create: mockCreate,
          },
        };
      }),
    },
  };
});

describe("POST /google-play/users/:userId", () => {
  let mockAndroidPublisherCreate;
  let originalDeveloperId;

  beforeAll(() => {
    originalDeveloperId = process.env.GOOGLE_PLAY_DEVELOPERID;
    process.env.GOOGLE_PLAY_DEVELOPERID = "dev-123456";
  });

  afterAll(() => {
    process.env.GOOGLE_PLAY_DEVELOPERID = originalDeveloperId;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAndroidPublisherCreate = google.androidpublisher().users.create;
  });

  it("should return 400 if userId is not an integer", async () => {
    const res = await request(app)
      .post("/google-play/users/abc")
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/userId must be an integer/i);
  });

  it("should return 404 if user is not found in the database", async () => {
    const pool = getPool();
    const originalQuery = pool.query;
    pool.query = jest.fn().mockImplementation((text, params) => {
      if (text.includes("SELECT service_id FROM services")) {
        return Promise.resolve({ rows: [{ service_id: 1 }] });
      }
      if (text.includes("SELECT email FROM users")) {
        return Promise.resolve({ rows: [] }); // User not found
      }
      return Promise.resolve({ rows: [] });
    });

    try {
      const res = await request(app)
        .post("/google-play/users/999")
        .send({});

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/User not found/i);
    } finally {
      pool.query = originalQuery;
    }
  });

  it("should attempt to call Google Play users.create API with only compulsory email when valid user is found", async () => {
    // Mock successful Google Play API call
    mockAndroidPublisherCreate.mockResolvedValue({
      data: {
        email: "test-play-user@example.com",
      },
    });

    // Mock DB queries so that we don't depend on actual DB records
    const pool = getPool();
    const originalQuery = pool.query;
    pool.query = jest.fn().mockImplementation((text, params) => {
      if (text.includes("SELECT service_id FROM services")) {
        return Promise.resolve({ rows: [{ service_id: 1 }] });
      }
      if (text.includes("SELECT email FROM users")) {
        return Promise.resolve({ rows: [{ email: "test-play-user@example.com" }] });
      }
      if (text.includes("SELECT access_id FROM user_service_access")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("INSERT INTO user_service_access")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("INSERT INTO log")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    // We also mock fs.existsSync to simulate that the credentials file exists
    const fs = require("fs");
    const originalExistsSync = fs.existsSync;
    const originalLstatSync = fs.lstatSync;
    const originalReaddirSync = fs.readdirSync;

    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.lstatSync = jest.fn().mockReturnValue({ isDirectory: () => true });
    fs.readdirSync = jest.fn().mockReturnValue(["credentials.json"]);

    try {
      const res = await request(app)
        .post("/google-play/users/42")
        .send({});

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe("test-play-user@example.com");
      expect(mockAndroidPublisherCreate).toHaveBeenCalledTimes(1);
      expect(mockAndroidPublisherCreate).toHaveBeenCalledWith({
        parent: "developers/dev-123456",
        requestBody: { 
          email: "test-play-user@example.com",
          developerAccountPermissions: ["CAN_VIEW_NON_FINANCIAL_DATA_GLOBAL"]
        },
      });
    } finally {
      // Restore mocks
      pool.query = originalQuery;
      fs.existsSync = originalExistsSync;
      fs.lstatSync = originalLstatSync;
      fs.readdirSync = originalReaddirSync;
    }
  });

  it("should handle Google Play API failures and log them to the DB", async () => {
    mockAndroidPublisherCreate.mockRejectedValue(new Error("API Permission Denied"));

    const pool = getPool();
    const originalQuery = pool.query;
    let loggedFailure = false;

    pool.query = jest.fn().mockImplementation((text, params) => {
      if (text.includes("SELECT service_id FROM services")) {
        return Promise.resolve({ rows: [{ service_id: 1 }] });
      }
      if (text.includes("SELECT email FROM users")) {
        return Promise.resolve({ rows: [{ email: "test-play-user@example.com" }] });
      }
      if (text.includes("INSERT INTO log")) {
        loggedFailure = true;
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const fs = require("fs");
    const originalExistsSync = fs.existsSync;
    const originalLstatSync = fs.lstatSync;
    const originalReaddirSync = fs.readdirSync;

    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.lstatSync = jest.fn().mockReturnValue({ isDirectory: () => true });
    fs.readdirSync = jest.fn().mockReturnValue(["credentials.json"]);

    try {
      const res = await request(app)
        .post("/google-play/users/42")
        .send({});

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("API Permission Denied");
      expect(loggedFailure).toBe(true);
    } finally {
      pool.query = originalQuery;
      fs.existsSync = originalExistsSync;
      fs.lstatSync = originalLstatSync;
      fs.readdirSync = originalReaddirSync;
    }
  });
});
