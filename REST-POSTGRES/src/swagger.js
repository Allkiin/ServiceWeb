const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Marketplace API", version: "1.0.0", description: "REST API for a video game marketplace" },
  },
  apis: ["./src/routes/*.js"],
});

module.exports = swaggerSpec;
