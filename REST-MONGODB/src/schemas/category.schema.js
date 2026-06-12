const z = require("zod");

const CategorySchema = z.object({
  _id: z.string(),
  name: z.string(),
});

const CreateCategorySchema = CategorySchema.omit({ _id: true });

module.exports = { CategorySchema, CreateCategorySchema };
