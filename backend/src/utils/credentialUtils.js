/**
 * @file credentialUtils.js
 * @description Centralized helper utility to find and parse service credential files (.json / .p8).
 */

"use strict";

const path = require("path");
const fs = require("fs");

/**
 * Scans a folder for a file matching an extension and returns its absolute file path.
 * @param {string} folderName - Folder relative to backend directory (e.g. 'googleplay_json')
 * @param {string} extension - File extension to search for (e.g. '.json' or '.p8')
 * @returns {string|null} - Absolute path or null if not found
 */
function getCredentialFilePath(folderName, extension = ".json") {
  const folderPath = path.join(__dirname, "../../", folderName);
  if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    const files = fs.readdirSync(folderPath);
    const targetFile = files.find((f) => f.endsWith(extension));
    if (targetFile) {
      return path.join(folderPath, targetFile);
    }
  }
  return null;
}

/**
 * Reads and parses a JSON credential file from a relative folder.
 * @param {string} folderName - Relative folder name (e.g. 'firebase_json')
 * @returns {Object} - Parsed JSON object
 */
function readJsonCredential(folderName) {
  const filePath = getCredentialFilePath(folderName, ".json");
  if (!filePath) {
    throw new Error(`No .json credentials file found inside the ${folderName} folder.`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

/**
 * Reads raw content of a credential file (e.g. .p8 key).
 * @param {string} folderName - Relative folder name (e.g. 'apple_key')
 * @param {string} extension - File extension (e.g. '.p8')
 * @returns {string|null} - Raw file content or null
 */
function readRawCredential(folderName, extension = ".p8") {
  const filePath = getCredentialFilePath(folderName, extension);
  if (!filePath) return null;
  return fs.readFileSync(filePath, "utf8");
}

module.exports = {
  getCredentialFilePath,
  readJsonCredential,
  readRawCredential,
};
