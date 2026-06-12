const z = require("zod");

const ProductSchema = z.object({
  _id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
  categoryIds: z.array(z.string()).default([]),
});

const CreateProductSchema = ProductSchema.omit({ _id: true });
const UpdateProductSchema = CreateProductSchema.partial();

module.exports = { ProductSchema, CreateProductSchema, UpdateProductSchema };
