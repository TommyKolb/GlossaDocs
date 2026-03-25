import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts", "test/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage/backend",
      exclude: [
        "**/*.d.ts",
        "**/dist/**",
        "test/**",
        "**/*.config.*",
      ],
    },
  },
});
