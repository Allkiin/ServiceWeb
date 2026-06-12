const express = require("express");
const sql = require("../db");
const { CreateProductSchema } = require("../schemas/product.schema");

const router = express.Router();

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products (with optional filters)
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Filter by name (contains)
 *       - in: query
 *         name: about
 *         schema: { type: string }
 *         description: Filter by description (contains)
 *       - in: query
 *         name: price
 *         schema: { type: number }
 *         description: Filter by max price
 *     responses:
 *       200:
 *         description: List of products
 */
router.get("/", async (req, res) => {
  const { name, about, price } = req.query;

  let products;
  if (!name && !about && !price) {
    products = await sql`SELECT * FROM products`;
  } else {
    const conditions = [];
    if (name) conditions.push(sql`name ILIKE ${"%" + name + "%"}`);
    if (about) conditions.push(sql`about ILIKE ${"%" + about + "%"}`);
    if (price) conditions.push(sql`price <= ${parseFloat(price)}`);
    const where = conditions.reduce((a, b) => sql`${a} AND ${b}`);
    products = await sql`SELECT * FROM products WHERE ${where}`;
  }

  res.send(products);
});

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get a product by ID (includes reviews)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Product with reviews
 *       404:
 *         description: Not found
 */
router.get("/:id", async (req, res) => {
  const product = await sql`SELECT * FROM products WHERE id = ${req.params.id}`;

  if (!product.length) {
    return res.status(404).send({ message: "Not found" });
  }

  const reviews = await sql`SELECT * FROM reviews WHERE product_id = ${req.params.id}`;
  res.send({ ...product[0], reviews });
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a product
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               about: { type: string }
 *               price: { type: number }
 *     responses:
 *       200:
 *         description: Created product
 *       400:
 *         description: Validation error
 */
router.post("/", async (req, res) => {
  const result = CreateProductSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(result);
  }

  const { name, about, price } = result.data;
  const product = await sql`
    INSERT INTO products (name, about, price)
    VALUES (${name}, ${about}, ${price})
    RETURNING *
  `;

  res.send(product[0]);
});

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted product
 *       404:
 *         description: Not found
 */
router.delete("/:id", async (req, res) => {
  const product = await sql`
    DELETE FROM products WHERE id = ${req.params.id} RETURNING *
  `;

  if (!product.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(product[0]);
});

module.exports = router;
