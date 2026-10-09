/**
 * @file authMock.js
 * @description Shared fake identity for integration tests.
 *
 * Tests stub requireAuth rather than the application branching on NODE_ENV.
 * Keeping the bypass in the test suite means it cannot ship: a production build
 * has no code path that grants a session without one.
 *
 * Usage, at the top of a test file:
 *
 *   jest.mock("../../src/middlewares/requireAuth.middleware", () =>
 *     jest.fn((req, _res, next) => {
 *       req.user = require("../helpers/authMock").TEST_USER;
 *       next();
 *     })
 *   );
 */

"use strict";

const TEST_USER = Object.freeze({
  userId: 1,
  email: "test@example.com",
  name: "Test User",
  role: "ADMIN",
  requiresPasswordChange: false,
});

module.exports = { TEST_USER };
