const sql = require("../db");

const getOrderTotal = async (productIds) => {
  if (!productIds.length) return 0;
  const products = await sql`SELECT price FROM products WHERE id = ANY(${productIds})`;
  const subtotal = products.reduce((sum, p) => sum + parseFloat(p.price), 0);
  return Math.round(subtotal * 1.2 * 100) / 100;
};

module.exports = { getOrderTotal };
