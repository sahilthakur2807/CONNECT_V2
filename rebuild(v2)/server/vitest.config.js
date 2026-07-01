import { defineConfig } from "vitest/config";

process.env.DATABASE_URL = "postgresql://dummy:dummy@localhost:5432/dummy";
process.env.JWT_SECRET = "dummy-secret-key-for-test-environments-only";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    alias: {
      "@domain": "./src/domain",
      "@features": "./src/features",
      "@infrastructure": "./src/infrastructure",
      "@presentation": "./src/presentation",
      "@shared": "./src/shared",
    },
  },
});
