import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    env: {
      VITE_API_BASE_URL: "http://api.test",
      VITE_COGNITO_REGION: "eu-west-1",
      VITE_COGNITO_CLIENT_ID: "testclientid",
      VITE_PASSWORD_POLICY:
        '{"minimum_length":10,"require_lowercase":true,"require_uppercase":true,"require_numbers":true,"require_symbols":false}',
    },
  },
});
