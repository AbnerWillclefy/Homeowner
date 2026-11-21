import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    env: {
      VITE_API_URL: "http://api.test",
      VITE_COGNITO_REGION: "eu-west-1",
      VITE_COGNITO_CLIENT_ID: "testclientid",
      VITE_PASSWORD_POLICY:
        '{"minimum_length":10,"require_lowercase":true,"require_uppercase":true,"require_numbers":true,"require_symbols":false}',
    },
  },
});
