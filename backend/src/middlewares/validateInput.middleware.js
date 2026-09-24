/**
 * @file validateInput.middleware.js
 * @description Middleware helper to validate request params/body types (e.g. integer userId).
 */

"use strict";

const ApiError = require("../utils/ApiError");

/**
 * Validates that specified route params (e.g. 'userId') are positive integers.
 * @param {string[]} paramNames
 */
function validateIntegerParams(...paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      if (req.params[name] !== undefined) {
        const val = Number.parseInt(req.params[name], 10);
        if (!Number.isInteger(val) || val <= 0) {
          return next(ApiError.badRequest(`${name} must be a positive integer.`));
        }
      }
    }
    next();
  };
}

module.exports = {
  validateIntegerParams,
};
