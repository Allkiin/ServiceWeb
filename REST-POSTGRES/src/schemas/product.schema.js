const z = require("zod");

const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
});
const CreateProductSchema = ProductSchema.omit({ id: true });

module.exports = { ProductSchema, CreateProductSchema };
