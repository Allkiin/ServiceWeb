const z = require("zod");

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

module.exports = { CreateOrderSchema, PatchOrderSchema };
