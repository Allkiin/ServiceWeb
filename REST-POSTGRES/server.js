const express = require("express");
const postgres = require("postgres");
const z = require("zod");
const crypto = require("crypto");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();
const port = 8000;
const sql = postgres({ db: "mydb", user: "user", password: "password" });

app.use(express.json());

// Swagger
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Marketplace API", version: "1.0.0", description: "REST API for a video game marketplace" },
  },
  apis: ["./server.js"],
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ==================== UTILITIES ====================

const hashPassword = (password) =>
  crypto.createHash("sha512").update(password).digest("hex");

const omitPassword = ({ password, ...rest }) => rest;

// ==================== SCHEMAS ====================

const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
});
const CreateProductSchema = ProductSchema.omit({ id: true });

const UserSchema = z.object({
  id: z.number(),
  username: z.string().min(1),
  password: z.string().min(8),
  email: z.string().email(),
});
const CreateUserSchema = UserSchema.omit({ id: true });
const PatchUserSchema = CreateUserSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

const CreateOrderSchema = z.object({
  user_id: z.number().int().positive(),
  product_ids: z.array(z.number().int().positive()).min(1),
  payment: z.boolean().optional().default(false),
});
const PatchOrderSchema = z.object({
  user_id: z.number().int().positive().optional(),
  product_ids: z.array(z.number().int().positive()).min(1).optional(),
  payment: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

const CreateReviewSchema = z.object({
  user_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  score: z.number().int().min(1).max(5),
  content: z.string().min(1),
});
const PatchReviewSchema = CreateReviewSchema.omit({ user_id: true, product_id: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

// ==================== HELPERS ====================

const getOrderTotal = async (productIds) => {
  if (!productIds.length) return 0;
  const products = await sql`SELECT price FROM products WHERE id = ANY(${productIds})`;
  const subtotal = products.reduce((sum, p) => sum + parseFloat(p.price), 0);
  return Math.round(subtotal * 1.2 * 100) / 100;
};

const updateProductReviews = async (productId) => {
  const reviews = await sql`SELECT score FROM reviews WHERE product_id = ${productId}`;
  const reviewIds = await sql`SELECT id FROM reviews WHERE product_id = ${productId}`;
  const avgScore = reviews.length
    ? reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length
    : 0;
  await sql`
    UPDATE products
    SET review_ids = ${reviewIds.map((r) => r.id)},
        average_score = ${avgScore}
    WHERE id = ${productId}
  `;
};

// ==================== ROOT ====================

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Hello World
 */
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// ==================== PRODUCTS ====================

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
app.get("/products", async (req, res) => {
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
app.get("/products/:id", async (req, res) => {
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
app.post("/products", async (req, res) => {
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
app.delete("/products/:id", async (req, res) => {
  const product = await sql`
    DELETE FROM products WHERE id = ${req.params.id} RETURNING *
  `;

  if (!product.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(product[0]);
});

// ==================== USERS (Exercise 1) ====================

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (without passwords)
 *     responses:
 *       200:
 *         description: List of users
 */
app.get("/users", async (req, res) => {
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
app.get("/users/:id", async (req, res) => {
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
app.post("/users", async (req, res) => {
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
app.put("/users/:id", async (req, res) => {
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
app.patch("/users/:id", async (req, res) => {
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
app.delete("/users/:id", async (req, res) => {
  const user = await sql`
    DELETE FROM users WHERE id = ${req.params.id} RETURNING id, username, email
  `;

  if (!user.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(user[0]);
});

// ==================== F2P GAMES (Exercise 2) ====================

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
app.get("/f2p-games", async (req, res) => {
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
app.get("/f2p-games/:id", async (req, res) => {
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

// ==================== ORDERS (Exercise 4) ====================

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders (with user and products)
 *     responses:
 *       200:
 *         description: List of orders
 */
app.get("/orders", async (req, res) => {
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
app.get("/orders/:id", async (req, res) => {
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
app.post("/orders", async (req, res) => {
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
app.put("/orders/:id", async (req, res) => {
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
app.patch("/orders/:id", async (req, res) => {
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
app.delete("/orders/:id", async (req, res) => {
  const order = await sql`DELETE FROM orders WHERE id = ${req.params.id} RETURNING *`;

  if (!order.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(order[0]);
});

// ==================== REVIEWS (Exercise 5) ====================

/**
 * @swagger
 * /reviews:
 *   get:
 *     summary: Get all reviews
 *     responses:
 *       200:
 *         description: List of reviews
 */
app.get("/reviews", async (req, res) => {
  const reviews = await sql`SELECT * FROM reviews`;
  res.send(reviews);
});

/**
 * @swagger
 * /reviews/{id}:
 *   get:
 *     summary: Get a review by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Review
 *       404:
 *         description: Not found
 */
app.get("/reviews/:id", async (req, res) => {
  const review = await sql`SELECT * FROM reviews WHERE id = ${req.params.id}`;

  if (!review.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(review[0]);
});

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Create a review (updates product average score)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id: { type: integer }
 *               product_id: { type: integer }
 *               score: { type: integer, minimum: 1, maximum: 5 }
 *               content: { type: string }
 *     responses:
 *       200:
 *         description: Created review
 *       400:
 *         description: Validation error
 *       404:
 *         description: User or product not found
 */
app.post("/reviews", async (req, res) => {
  const result = CreateReviewSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(result);
  }

  const { user_id, product_id, score, content } = result.data;

  const user = await sql`SELECT id FROM users WHERE id = ${user_id}`;
  if (!user.length) {
    return res.status(404).send({ message: "User not found" });
  }

  const product = await sql`SELECT id FROM products WHERE id = ${product_id}`;
  if (!product.length) {
    return res.status(404).send({ message: "Product not found" });
  }

  const review = await sql`
    INSERT INTO reviews (user_id, product_id, score, content)
    VALUES (${user_id}, ${product_id}, ${score}, ${content})
    RETURNING *
  `;

  await updateProductReviews(product_id);

  res.send(review[0]);
});

/**
 * @swagger
 * /reviews/{id}:
 *   put:
 *     summary: Replace a review (score and content required)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Updated review
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 */
app.put("/reviews/:id", async (req, res) => {
  const result = z.object({
    score: z.number().int().min(1).max(5),
    content: z.string().min(1),
  }).safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(result);
  }

  const { score, content } = result.data;

  const review = await sql`
    UPDATE reviews
    SET score = ${score}, content = ${content}, updated_at = NOW()
    WHERE id = ${req.params.id}
    RETURNING *
  `;

  if (!review.length) {
    return res.status(404).send({ message: "Not found" });
  }

  await updateProductReviews(review[0].product_id);

  res.send(review[0]);
});

/**
 * @swagger
 * /reviews/{id}:
 *   patch:
 *     summary: Partially update a review
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Updated review
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 */
app.patch("/reviews/:id", async (req, res) => {
  const result = PatchReviewSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(result);
  }

  const updates = { ...result.data, updated_at: new Date() };

  const review = await sql`
    UPDATE reviews
    SET ${sql(updates, ...Object.keys(updates))}
    WHERE id = ${req.params.id}
    RETURNING *
  `;

  if (!review.length) {
    return res.status(404).send({ message: "Not found" });
  }

  await updateProductReviews(review[0].product_id);

  res.send(review[0]);
});

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Delete a review (updates product average score)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted review
 *       404:
 *         description: Not found
 */
app.delete("/reviews/:id", async (req, res) => {
  const review = await sql`DELETE FROM reviews WHERE id = ${req.params.id} RETURNING *`;

  if (!review.length) {
    return res.status(404).send({ message: "Not found" });
  }

  await updateProductReviews(review[0].product_id);

  res.send(review[0]);
});

// ==================== START ====================

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
  console.log(`API docs available at http://localhost:${port}/api-docs`);
});
