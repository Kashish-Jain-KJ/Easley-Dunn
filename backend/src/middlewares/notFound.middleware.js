/**
 * @file notFound.middleware.js
 * @description Catches requests that don't match any registered route
 * and forwards a 404 ApiError to the global error handler.
 */

"use strict";

const ApiError = require("../utils/ApiError");

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = notFound;
