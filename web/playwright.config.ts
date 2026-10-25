import { defineConfig, devices } from "@playwright/test";

// 127.0.0.1 everywhere (baseURL, preview host) so localhost resolving to ::1 can never make origins differ.
const baseURL = "http://127.0.0.1:4173";
// The same app built with Replan on (`npm run build:e2e:replan`), for the specs that need the staging-only control.
const replanBaseURL = "http://127.0.0.1:4174";

// Expects `npm run build:e2e` and `npm run build:e2e:replan` to have run: Playwright does not build, and a stale
// dist-e2e is the one local pitfall.
export default defineConfig({
  testDir: "./e2e/specs",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  retries: 0,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "en-US",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    colorScheme: "light",
    reducedMotion: "reduce",
    // A canonical zone: the Create Home form defaults to the browser zone only if Intl lists it.
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Runs only the specs that need Replan on. A spec in both projects reads the project name to know which build it has.
    {
      name: "chromium-replan",
      testMatch: ["**/today-first-load.spec.ts"],
      use: { ...devices["Desktop Chrome"], baseURL: replanBaseURL },
    },
  ],
  webServer: [
    {
      command: "npm run preview -- --outDir dist-e2e --host 127.0.0.1 --port 4173 --strictPort",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npm run preview -- --outDir dist-e2e-replan --host 127.0.0.1 --port 4174 --strictPort",
      url: replanBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
