/**
 * @file users.routes.js
 * @description Routes for the /users resource (Tracked System Employees).
 *
 * GET  /users                → list all users
 * POST /users                → add a new tracked system user/employee
 * GET  /users/:userId/access → get access info for a user
 */

"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  getUsers,
  createSystemUser,
  getUserAccess,
  onboardUserAccess,
  offboardUserAccess,
  getUserLogs,
} = require("../controllers/users.controller");

const router = Router();

router.get("/", asyncHandler(getUsers));
router.post("/", asyncHandler(createSystemUser));
router.get("/:userId/access", asyncHandler(getUserAccess));
router.post("/:userId/access/:accessId/onboard", asyncHandler(onboardUserAccess));
router.post("/:userId/access/:accessId/offboard", asyncHandler(offboardUserAccess));
router.get("/:userId/logs", asyncHandler(getUserLogs));

module.exports = router;
