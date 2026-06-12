const express = require("express");
const z = require("zod");
const sql = require("../db");
const { updateProductReviews } = require("../utils/reviews");
const { CreateReviewSchema, PatchReviewSchema } = require("../schemas/review.schema");

const router = express.Router();

router.get("/", async (req, res) => {
  const reviews = await sql`SELECT * FROM reviews`;
  res.send(reviews);
});

router.get("/:id", async (req, res) => {
  const review = await sql`SELECT * FROM reviews WHERE id = ${req.params.id}`;

  if (!review.length) {
    return res.status(404).send({ message: "Not found" });
  }

  res.send(review[0]);
});

router.post("/", async (req, res) => {
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

router.put("/:id", async (req, res) => {
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

router.patch("/:id", async (req, res) => {
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

router.delete("/:id", async (req, res) => {
  const review = await sql`DELETE FROM reviews WHERE id = ${req.params.id} RETURNING *`;

  if (!review.length) {
    return res.status(404).send({ message: "Not found" });
  }

  await updateProductReviews(review[0].product_id);

  res.send(review[0]);
});

module.exports = router;
