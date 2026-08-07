"use strict";

const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { onboardFirebaseUser, removeFirebaseUser } = require("../controllers/firebase.controller");

const router = Router();

/**
 * @swagger
 * /firebase/users/{userId}:
 *   post:
 *     summary: Onboard a user to Firebase Authentication
 *     tags: [Firebase]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully onboarded user to Firebase
 *       400:
 *         description: Missing required identifiers in database
 *       404:
 *         description: User or access record not found
 *       500:
 *         description: Firebase API request failed
 */
router.post("/users/:userId", asyncHandler(onboardFirebaseUser));

/**
 * @swagger
 * /firebase/users/{userId}:
 *   delete:
 *     summary: Remove a user from Firebase Authentication
 *     tags: [Firebase]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully removed user from Firebase
 *       400:
 *         description: Missing required identifiers in database
 *       404:
 *         description: Access record not found
 *       500:
 *         description: Firebase API request failed
 */
router.delete("/users/:userId", asyncHandler(removeFirebaseUser));

module.exports = router;
