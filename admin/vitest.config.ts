import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    env: {
      VITE_ENVIRONMENT: "staging",
      VITE_API_URL: "http://api.test",
      VITE_COGNITO_REGION: "eu-west-1",
      VITE_COGNITO_CLIENT_ID: "testclientid",
      VITE_ADMIN_URLS: '{"staging":"https://admin.staging.example.com","production":"https://admin.example.com"}',
    },
  },
});
