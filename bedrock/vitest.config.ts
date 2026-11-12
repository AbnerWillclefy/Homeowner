import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so the test root stays bedrock/, not showcase/.
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "showcase/**/*.test.tsx"],
  },
});
