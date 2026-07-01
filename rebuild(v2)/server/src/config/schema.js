import { z } from "zod";

export const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z
    .preprocess((val) => Number(val), z.number().int().min(1).max(65535))
    .default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z
    .string()
    .min(8, "JWT_SECRET must be at least 8 characters long"),
  CORS_ORIGIN: z.string().default("*"),
});
