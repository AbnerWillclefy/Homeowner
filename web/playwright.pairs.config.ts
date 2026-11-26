import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// The design pairs for the ui-screenshots check: `npm run build:e2e && PAIRS_ALL=1 npx playwright test -c playwright.pairs.config.ts`.
// Kept out of the e2e suite (its own testDir). PNGs land in pairs-out/, one JSON per artboard in pairs-results/.
export default defineConfig({
  ...base,
  testDir: "./e2e/pairs",
  testMatch: "**/*.capture.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
});
