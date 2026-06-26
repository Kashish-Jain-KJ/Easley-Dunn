/**
 * @file appleStoreConnect.test.js
 * @description Integration tests for Apple Store Connect onboarding endpoint.
 */

"use strict";

require("dotenv").config();

const request = require("supertest");
const app = require("../../src/app");
const { getPool } = require("../../src/db/database");
const crypto = require("crypto");

describe("POST /appleStoreConnect/users/:userId", () => {
  let mockPrivateKeyPem;
  let originalKeyId;
  let originalIssuerId;
  let originalPrivateKey;

  beforeAll(() => {
    // Save original env vars
    originalKeyId = process.env.APPLE_KEY_ID;
    originalIssuerId = process.env.APPLE_ISSUER_ID;
    originalPrivateKey = process.env.APPLE_PRIVATE_KEY;

    // Generate real EC key pair for signing validation
    const { privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    mockPrivateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });

    process.env.APPLE_KEY_ID = "KEYID12345";
    process.env.APPLE_ISSUER_ID = "issuer-uuid-12345";
    process.env.APPLE_PRIVATE_KEY = mockPrivateKeyPem;
  });

  afterAll(() => {
    // Restore original env vars
    process.env.APPLE_KEY_ID = originalKeyId;
    process.env.APPLE_ISSUER_ID = originalIssuerId;
    process.env.APPLE_PRIVATE_KEY = originalPrivateKey;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock global fetch
    global.fetch = jest.fn();
  });

  it("should return 400 if userId is not an integer", async () => {
    const res = await request(app)
      .post("/appleStoreConnect/users/abc")
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
        return Promise.resolve({ rows: [{ service_id: 10 }] });
      }
      if (text.includes("SELECT email FROM users")) {
        return Promise.resolve({ rows: [] }); // User not found
      }
      return Promise.resolve({ rows: [] });
    });

    try {
      const res = await request(app)
        .post("/appleStoreConnect/users/999")
        .send({});

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/User not found/i);
    } finally {
      pool.query = originalQuery;
    }
  });

  it("should successfully invite/onboard user and log the success", async () => {
    // Mock successful Apple Store Connect response
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          data: {
            id: "invite-uuid-abc",
            type: "userInvitations",
            attributes: {
              email: "test-apple-user@example.com",
            },
          },
        }),
    });

    const pool = getPool();
    const originalQuery = pool.query;
    let accessUpdated = false;
    let successLogged = false;

    pool.query = jest.fn().mockImplementation((text, params) => {
      if (text.includes("SELECT service_id FROM services")) {
        return Promise.resolve({ rows: [{ service_id: 10 }] });
      }
      if (text.includes("SELECT email, first_name, last_name FROM users")) {
        return Promise.resolve({
          rows: [
            {
              email: "test-apple-user@example.com",
              first_name: "Apple",
              last_name: "Tester",
            },
          ],
        });
      }
      if (text.includes("SELECT access_id FROM user_service_access")) {
        return Promise.resolve({ rows: [{ access_id: 100 }] });
      }
      if (text.includes("UPDATE user_service_access")) {
        accessUpdated = true;
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("INSERT INTO log")) {
        successLogged = text.includes("'SUCCESS'");
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    try {
      const res = await request(app)
        .post("/appleStoreConnect/users/42")
        .send({});

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("invite-uuid-abc");
      expect(accessUpdated).toBe(true);
      expect(successLogged).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      const fetchCallArgs = global.fetch.mock.calls[0];
      expect(fetchCallArgs[0]).toBe("https://api.appstoreconnect.apple.com/v1/userInvitations");
      expect(fetchCallArgs[1].method).toBe("POST");
      expect(fetchCallArgs[1].headers["Content-Type"]).toBe("application/json");
      expect(fetchCallArgs[1].headers["Authorization"]).toMatch(/^Bearer ey/);
      
      const payload = JSON.parse(fetchCallArgs[1].body);
      expect(payload.data.attributes.email).toBe("test-apple-user@example.com");
      expect(payload.data.attributes.firstName).toBe("Apple");
      expect(payload.data.attributes.lastName).toBe("Tester");
    } finally {
      pool.query = originalQuery;
    }
  });

  it("should handle Apple Store Connect API error response and log the failure", async () => {
    // Mock error from Apple Store Connect API
    global.fetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          errors: [
            {
              code: "ENTITY_ERROR.RELATIONSHIP.REQUIRED",
              title: "A relationship is required.",
              detail: "You must provide a valid email.",
            },
          ],
        }),
    });

    const pool = getPool();
    const originalQuery = pool.query;
    let failureLogged = false;
    let loggedErrorMessage = "";

    pool.query = jest.fn().mockImplementation((text, params) => {
      if (text.includes("SELECT service_id FROM services")) {
        return Promise.resolve({ rows: [{ service_id: 10 }] });
      }
      if (text.includes("SELECT email, first_name, last_name FROM users")) {
        return Promise.resolve({
          rows: [
            {
              email: "test-apple-user@example.com",
              first_name: "Apple",
              last_name: "Tester",
            },
          ],
        });
      }
      if (text.includes("SELECT access_id FROM user_service_access")) {
        return Promise.resolve({ rows: [{ access_id: 100 }] });
      }
      if (text.includes("INSERT INTO log")) {
        failureLogged = text.includes("'FAILED'");
        // Log query params are user_id, service_id, command_type, status, error_message, created_at
        // In the controller: pool.query(..., [userIdInt, serviceIdVal, errMessage])
        loggedErrorMessage = params[2]; // Index 2 is $3 (error_message)
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    try {
      const res = await request(app)
        .post("/appleStoreConnect/users/42")
        .send({});

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("A relationship is required.");
      expect(res.body.error).toContain("ENTITY_ERROR.RELATIONSHIP.REQUIRED");
      expect(failureLogged).toBe(true);
      expect(loggedErrorMessage).toContain("ENTITY_ERROR.RELATIONSHIP.REQUIRED");
    } finally {
      pool.query = originalQuery;
    }
  });

  it("should handle general request exception, log failure, and return 500", async () => {
    global.fetch.mockRejectedValue(new Error("Network connection lost."));

    const pool = getPool();
    const originalQuery = pool.query;
    let failureLogged = false;

    pool.query = jest.fn().mockImplementation((text, params) => {
      if (text.includes("SELECT service_id FROM services")) {
        return Promise.resolve({ rows: [{ service_id: 10 }] });
      }
      if (text.includes("SELECT email, first_name, last_name FROM users")) {
        return Promise.resolve({
          rows: [
            {
              email: "test-apple-user@example.com",
              first_name: "Apple",
              last_name: "Tester",
            },
          ],
        });
      }
      if (text.includes("SELECT access_id FROM user_service_access")) {
        return Promise.resolve({ rows: [{ access_id: 100 }] });
      }
      if (text.includes("INSERT INTO log")) {
        failureLogged = text.includes("'FAILED'");
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    try {
      const res = await request(app)
        .post("/appleStoreConnect/users/42")
        .send({});

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Network connection lost.");
      expect(failureLogged).toBe(true);
    } finally {
      pool.query = originalQuery;
    }
  });

  describe("DELETE /appleStoreConnect/users/:userId", () => {
    it("should return 400 if userId is not an integer", async () => {
      const res = await request(app)
        .delete("/appleStoreConnect/users/abc")
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/userId must be an integer/i);
    });

    it("should return 404 if active access record is not found in database", async () => {
      const pool = getPool();
      const originalQuery = pool.query;
      let loggedFailure = false;

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services")) {
          return Promise.resolve({ rows: [{ service_id: 10 }] });
        }
        if (text.includes("SELECT access_id, external_user_identifier FROM user_service_access")) {
          return Promise.resolve({ rows: [] }); // No active access
        }
        if (text.includes("INSERT INTO log")) {
          loggedFailure = text.includes("'FAILED'");
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app)
          .delete("/appleStoreConnect/users/42")
          .send({});

        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/access record not found/i);
        expect(loggedFailure).toBe(true);
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should successfully remove user from active members when email matches", async () => {
      // Mock search lists and delete API calls
      global.fetch = jest.fn().mockImplementation((url, options) => {
        if (url.includes("/v1/users")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                data: [
                  {
                    id: "apple-user-uuid-999",
                    type: "users",
                    attributes: {
                      username: "test-apple-user@example.com",
                    },
                  },
                ],
              }),
          });
        }
        if (url.includes("/v1/users/apple-user-uuid-999")) {
          return Promise.resolve({
            ok: true,
            status: 204, // No content
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const pool = getPool();
      const originalQuery = pool.query;
      let accessUpdated = false;
      let logSuccess = false;

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services")) {
          return Promise.resolve({ rows: [{ service_id: 10 }] });
        }
        if (text.includes("SELECT access_id, external_user_identifier FROM user_service_access")) {
          return Promise.resolve({ rows: [{ access_id: 100, external_user_identifier: "test-apple-user@example.com" }] });
        }
        if (text.includes("UPDATE user_service_access")) {
          accessUpdated = true;
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO log")) {
          logSuccess = text.includes("'SUCCESS'");
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app)
          .delete("/appleStoreConnect/users/42")
          .send({});

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain("Successfully removed");
        expect(accessUpdated).toBe(true);
        expect(logSuccess).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(2); // Search call + Delete call
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should successfully remove user from invitations if not found in active members but matched in invitations", async () => {
      // Mock search lists and delete API calls
      global.fetch = jest.fn().mockImplementation((url, options) => {
        if (url.includes("/v1/users")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: [] }), // Not found in users
          });
        }
        if (url.includes("/v1/userInvitations") && !url.includes("invite-uuid-555")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                data: [
                  {
                    id: "invite-uuid-555",
                    type: "userInvitations",
                    attributes: {
                      email: "test-apple-user@example.com",
                    },
                  },
                ],
              }),
          });
        }
        if (url.includes("/v1/userInvitations/invite-uuid-555")) {
          return Promise.resolve({
            ok: true,
            status: 204, // No content
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const pool = getPool();
      const originalQuery = pool.query;
      let accessUpdated = false;
      let logSuccess = false;

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services")) {
          return Promise.resolve({ rows: [{ service_id: 10 }] });
        }
        if (text.includes("SELECT access_id, external_user_identifier FROM user_service_access")) {
          return Promise.resolve({ rows: [{ access_id: 100, external_user_identifier: "test-apple-user@example.com" }] });
        }
        if (text.includes("UPDATE user_service_access")) {
          accessUpdated = true;
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("INSERT INTO log")) {
          logSuccess = text.includes("'SUCCESS'");
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app)
          .delete("/appleStoreConnect/users/42")
          .send({});

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain("Successfully removed");
        expect(accessUpdated).toBe(true);
        expect(logSuccess).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(3); // users search + invites search + delete invite call
      } finally {
        pool.query = originalQuery;
      }
    });

    it("should return 404 if user is not found in active members or pending invitations on Apple servers", async () => {
      global.fetch = jest.fn().mockImplementation((url, options) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }), // Returns empty array for both lists
        });
      });

      const pool = getPool();
      const originalQuery = pool.query;
      let logFailure = false;

      pool.query = jest.fn().mockImplementation((text, params) => {
        if (text.includes("SELECT service_id FROM services")) {
          return Promise.resolve({ rows: [{ service_id: 10 }] });
        }
        if (text.includes("SELECT access_id, external_user_identifier FROM user_service_access")) {
          return Promise.resolve({ rows: [{ access_id: 100, external_user_identifier: "test-apple-user@example.com" }] });
        }
        if (text.includes("INSERT INTO log")) {
          logFailure = text.includes("'FAILED'");
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      try {
        const res = await request(app)
          .delete("/appleStoreConnect/users/42")
          .send({});

        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/not found in Apple Store Connect/i);
        expect(logFailure).toBe(true);
      } finally {
        pool.query = originalQuery;
      }
    });
  });
});
