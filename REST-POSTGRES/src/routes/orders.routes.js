const express = require("express");
const sql = require("../db");
const { getOrderTotal } = require("../utils/orders");
const { CreateOrderSchema, PatchOrderSchema } = require("../schemas/order.schema");

const router = express.Router();

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders (with user and products)
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get("/", async (req, res) => {
  const orders = await sql`SELECT * FROM orders`;

  const result = await Promise.all(
    orders.map(async (order) => {
      const [user] = await sql`SELECT id, username, email FROM users WHERE id = ${order.user_id}`;
      const products = await sql`SELECT * FROM products WHERE id = ANY(${order.product_ids})`;
      const { user_id, product_ids, ...orderData } = order;
      return { ...orderData, user, products };
    })
  );

  res.send(result);
});

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get an order by ID (with user and products)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Order with user and products
 *       404:
 *         description: Not found
 */
router.get("/:id", async (req, res) => {
  const order = await sql`SELECT * FROM orders WHERE id = ${req.params.id}`;

  if (!order.length) {
    return res.status(404).send({ message: "Not found" });
  }

  const [user] = await sql`SELECT id, username, email FROM users WHERE id = ${order[0].user_id}`;
  const products = await sql`SELECT * FROM products WHERE id = ANY(${order[0].product_ids})`;
  const { user_id, product_ids, ...orderData } = order[0];

  res.send({ ...orderData, user, products });
});

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create an order (total calculated automatically with 20% VAT)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id: { type: integer }
 *               product_ids: { type: array, items: { type: integer } }
 *               payment: { type: boolean }
 *     responses:
 *       200:
 *         description: Created order
 *       400:
 *         description: Validation error
 *       404:
 *         description: User or products not found
 */
router.post("/", async (req, res) => {
  const result = CreateOrderSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(result);
  }

  const { user_id, product_ids, payment } = result.data;

  const user = await sql`SELECT id FROM users WHERE id = ${user_id}`;
  if (!user.length) {
    return res.status(404).send({ message: "User not found" });
  }

  const products = await sql`SELECT id FROM products WHERE id = ANY(${product_ids})`;
  if (products.length !== product_ids.length) {
    return res.status(404).send({ message: "One or more products not found" });
  }

  const total = await getOrderTotal(product_ids);

  const order = await sql`
    INSERT INTO orders (user_id, product_ids, total, payment)
    VALUES (${user_id}, ${product_ids}, ${total}, ${payment})
    RETURNING *
  `;

  res.send(order[0]);
});

/**
 * @swagger
 * /orders/{id}:
 *   put:
 *     summary: Replace an order (all fields required)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Updated order
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 */
router.put("/:id", async (req, res) => {
  const result = CreateOrderSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(result);
  }

  const { user_id, product_ids, payment } = result.data;

  const user = await sql`SELECT id FROM users WHERE id = ${user_id}`;
  if (!user.length) {
    return res.status(404).send({ message: "User not found" });
  }

  const products = await sql`SELECT id FROM products WHERE id = ANY(${product_ids})`;
  if (products.length !== product_ids.length) {
    return res.status(404).send({ message: "One or more products not found" });
  }

  const total = await getOrderTotal(product_ids);

  const order = await sql`
    UPDATE orders
    SET user_id = ${user_id}, product_ids = ${product_ids}, total = ${total},
        payment = ${payment}, updated_at = NOW()
    WHERE id = ${req.params.id}
    RETURNING *
  `;

  if (!order.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(order[0]);
});

/**
 * @swagger
 * /orders/{id}:
 *   patch:
 *     summary: Partially update an order
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Updated order
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 */
router.patch("/:id", async (req, res) => {
  const result = PatchOrderSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(result);
  }

  const updates = { ...result.data, updated_at: new Date() };

  if (updates.user_id) {
    const user = await sql`SELECT id FROM users WHERE id = ${updates.user_id}`;
    if (!user.length) {
      return res.status(404).send({ message: "User not found" });
    }
  }

  if (updates.product_ids) {
    const products = await sql`SELECT id FROM products WHERE id = ANY(${updates.product_ids})`;
    if (products.length !== updates.product_ids.length) {
      return res.status(404).send({ message: "One or more products not found" });
    }
    updates.total = await getOrderTotal(updates.product_ids);
  }

  const order = await sql`
    UPDATE orders
    SET ${sql(updates, ...Object.keys(updates))}
    WHERE id = ${req.params.id}
    RETURNING *
  `;

  if (!order.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(order[0]);
});

/**
 * @swagger
 * /orders/{id}:
 *   delete:
 *     summary: Delete an order
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted order
 *       404:
 *         description: Not found
 */
router.delete("/:id", async (req, res) => {
  const order = await sql`DELETE FROM orders WHERE id = ${req.params.id} RETURNING *`;

  if (!order.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(order[0]);
});

module.exports = router;
