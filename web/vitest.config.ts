import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      VITE_API_BASE_URL: "http://api.test",
      VITE_COGNITO_REGION: "eu-west-1",
      VITE_COGNITO_CLIENT_ID: "testclientid",
    },
  },
});
