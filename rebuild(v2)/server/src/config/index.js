import dotenv from "dotenv";
import { configSchema } from "./schema.js";

dotenv.config();

let parsedConfig;

try {
  parsedConfig = configSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  });
} catch (error) {
  console.error(
    "❌ Configuration validation failed! Please verify environment variables.",
  );
  if (error.errors) {
    console.error(JSON.stringify(error.errors, null, 2));
  } else {
    console.error(error);
  }
  process.exit(1);
}

export const config = parsedConfig;
