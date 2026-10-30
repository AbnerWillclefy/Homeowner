import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Captures the README screenshots into docs/screenshots/: `npm run build:e2e && npx playwright test -c playwright.readme.config.ts`.
// Kept out of the e2e suite (its own testDir), so CI never rewrites the images.
export default defineConfig({
  ...base,
  testDir: "./e2e/readme",
  testMatch: "**/*.capture.ts",
  fullyParallel: false,
  workers: 1,
});
