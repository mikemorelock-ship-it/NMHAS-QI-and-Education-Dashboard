import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    environment: "node",
    globals: false,
    coverage: {
      provider: "v8",
      include: [
        "src/lib/permissions.ts",
        "src/lib/password-validation.ts",
        "src/lib/utils.ts",
        "src/lib/pagination.ts",
        "src/lib/aggregation.ts",
        "src/lib/spc.ts",
        "src/lib/safe-error.ts",
        "src/lib/api-response.ts",
      ],
      reporter: ["text", "text-summary"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
