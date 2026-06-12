const express = require("express");
const sql = require("../db");
const { hashPassword } = require("../utils/password");
const { CreateUserSchema, PatchUserSchema } = require("../schemas/user.schema");

const router = express.Router();

router.get("/", async (req, res) => {
  const users = await sql`SELECT id, username, email FROM users`;
  res.send(users);
});

router.get("/:id", async (req, res) => {
  const user = await sql`SELECT id, username, email FROM users WHERE id = ${req.params.id}`;

  if (!user.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(user[0]);
});

router.post("/", async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(result);
  }

  const { username, password, email } = result.data;

  try {
    const user = await sql`
      INSERT INTO users (username, password, email)
      VALUES (${username}, ${hashPassword(password)}, ${email})
      RETURNING id, username, email
    `;
    res.send(user[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).send({ message: "Username or email already taken" });
    }
    throw err;
  }
});

router.put("/:id", async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(result);
  }

  const { username, password, email } = result.data;

  try {
    const user = await sql`
      UPDATE users
      SET username = ${username}, password = ${hashPassword(password)}, email = ${email}
      WHERE id = ${req.params.id}
      RETURNING id, username, email
    `;

    if (!user.length) {
      return res.status(404).send({ message: "Not found" });
    }

    res.send(user[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).send({ message: "Username or email already taken" });
    }
    throw err;
  }
});

router.patch("/:id", async (req, res) => {
  const result = PatchUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(result);
  }

  const updates = result.data;
  if (updates.password) {
    updates.password = hashPassword(updates.password);
  }

  try {
    const user = await sql`
      UPDATE users
      SET ${sql(updates, ...Object.keys(updates))}
      WHERE id = ${req.params.id}
      RETURNING id, username, email
    `;

    if (!user.length) {
      return res.status(404).send({ message: "Not found" });
    }

    res.send(user[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).send({ message: "Username or email already taken" });
    }
    throw err;
  }
});

router.delete("/:id", async (req, res) => {
  const user = await sql`
    DELETE FROM users WHERE id = ${req.params.id} RETURNING id, username, email
  `;

  if (!user.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(user[0]);
});

module.exports = router;
