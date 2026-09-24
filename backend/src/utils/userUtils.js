/**
 * @file userUtils.js
 * @description Central utility functions for user objects and string parsing.
 */

"use strict";

/**
 * Splits a full name string into first_name and last_name properties.
 * @param {string} name
 * @returns {{ first_name: string, last_name: string }}
 */
function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

module.exports = {
  splitName,
};
