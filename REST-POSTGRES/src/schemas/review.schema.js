const z = require("zod");

const CreateReviewSchema = z.object({
  user_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  score: z.number().int().min(1).max(5),
  content: z.string().min(1),
});
const PatchReviewSchema = CreateReviewSchema.omit({ user_id: true, product_id: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

module.exports = { CreateReviewSchema, PatchReviewSchema };
