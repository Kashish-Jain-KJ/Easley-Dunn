/**
 * @file ApiError.js
 * @description Custom operational error class.
 *
 * Distinguishes expected HTTP errors (4xx) from unexpected bugs (5xx),
 * which lets the global error handler respond correctly without exposing
 * internals.
 */

"use strict";

class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status code
   * @param {string} message     Human-readable message
   * @param {boolean} [isOperational=true]  true = expected, false = programmer error
   */
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg) {
    return new ApiError(400, msg);
  }

  static unauthorized(msg = "Unauthorized") {
    return new ApiError(401, msg);
  }

  static forbidden(msg = "Forbidden") {
    return new ApiError(403, msg);
  }

  static notFound(msg = "Resource not found") {
    return new ApiError(404, msg);
  }

  static conflict(msg) {
    return new ApiError(409, msg);
  }

  static internal(msg = "Internal server error") {
    return new ApiError(500, msg, false);
  }
}

module.exports = ApiError;
