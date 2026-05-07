/**
 * @file asyncHandler.js
 * @description Wraps async route handlers so unhandled promise rejections
 * are forwarded to Express's next() error pipeline automatically.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */

"use strict";

/**
 * @param {Function} fn  Async Express handler
 * @returns {Function}
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
