const express = require("express");

const router = express.Router();

/**
 * @swagger
 * /f2p-games:
 *   get:
 *     summary: Get all free-to-play games from FreeToGame
 *     responses:
 *       200:
 *         description: List of F2P games
 *       502:
 *         description: Upstream error
 */
router.get("/", async (req, res) => {
  const response = await fetch("https://www.freetogame.com/api/games");

  if (!response.ok) {
    return res.status(502).send({ message: "Failed to fetch F2P games" });
  }

  const games = await response.json();
  res.send(games);
});

/**
 * @swagger
 * /f2p-games/{id}:
 *   get:
 *     summary: Get a single free-to-play game by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: F2P game
 *       404:
 *         description: Not found
 *       502:
 *         description: Upstream error
 */
router.get("/:id", async (req, res) => {
  const response = await fetch(
    `https://www.freetogame.com/api/game?id=${req.params.id}`
  );

  if (response.status === 404) {
    return res.status(404).send({ message: "Not found" });
  }

  if (!response.ok) {
    return res.status(502).send({ message: "Failed to fetch game" });
  }

  const game = await response.json();
  res.send(game);
});

module.exports = router;
