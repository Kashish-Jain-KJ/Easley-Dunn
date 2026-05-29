/**
 * @file swagger.config.js
 * @description Swagger / OpenAPI 3.0 configuration.
 *
 * The spec is generated at runtime by swagger-jsdoc by scanning
 * every route file for JSDoc @swagger annotations.
 */

"use strict";

const swaggerJsdoc = require("swagger-jsdoc");
const appConfig = require("./app.config");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Easleydunn API",
      version: "1.0.0",
      description: "REST API documentation for the Easleydunn backend.",
    },
    servers: [
      {
        url: appConfig.apiUrl,
        description: "API Server",
      },
    ],
  },
  // Scan all route files for @swagger JSDoc blocks
  // apis: ["./src/routes/*.routes.js"]
  apis: ["./src/routes/*.routes.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
