const express = require("express");

const router = express.Router();

router.get("/", async (req, res) => {
  const response = await fetch("https://www.freetogame.com/api/games");

  if (!response.ok) {
    return res.status(502).send({ message: "Failed to fetch F2P games" });
  }

  const games = await response.json();
  res.send(games);
});

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
