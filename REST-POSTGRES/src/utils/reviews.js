const sql = require("../db");

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

module.exports = { updateProductReviews };
