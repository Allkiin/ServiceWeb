const express = require("express");
const sql = require("../db");
const { hashPassword } = require("../utils/password");
const { CreateUserSchema, PatchUserSchema } = require("../schemas/user.schema");

const router = express.Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (without passwords)
 *     responses:
 *       200:
 *         description: List of users
 */
router.get("/", async (req, res) => {
  const users = await sql`SELECT id, username, email FROM users`;
  res.send(users);
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID (without password)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: User
 *       404:
 *         description: Not found
 */
router.get("/:id", async (req, res) => {
  const user = await sql`SELECT id, username, email FROM users WHERE id = ${req.params.id}`;

  if (!user.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(user[0]);
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string, minLength: 8 }
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Created user (without password)
 *       400:
 *         description: Validation error
 *       409:
 *         description: Username or email already taken
 */
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

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Replace a user (all fields required)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string, minLength: 8 }
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Updated user (without password)
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 *       409:
 *         description: Username or email already taken
 */
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

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Partially update a user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string, minLength: 8 }
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Updated user (without password)
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 *       409:
 *         description: Username or email already taken
 */
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

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted user (without password)
 *       404:
 *         description: Not found
 */
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
