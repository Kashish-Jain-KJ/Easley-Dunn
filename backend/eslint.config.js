/**
 * @file eslint.config.js
 * @description ESLint 9 config for the backend. Run with `npm run lint`.
 */

"use strict";

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/", "logs/", "googledrive_json/"],
  },
  // Standard rule set: undefined variables, unused variables, unreachable code, etc.
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      // A leading underscore marks a deliberately unused value (e.g. `catch (_err)`).
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
];
