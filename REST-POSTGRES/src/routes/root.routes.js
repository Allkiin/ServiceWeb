const express = require("express");

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Hello World
 */
router.get("/", (req, res) => {
  res.send("Hello World!");
});

module.exports = router;
