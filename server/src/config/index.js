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
    CLIENT_URL: process.env.CLIENT_URL,
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
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
