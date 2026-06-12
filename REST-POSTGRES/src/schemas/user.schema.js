const z = require("zod");

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

module.exports = { UserSchema, CreateUserSchema, PatchUserSchema };
