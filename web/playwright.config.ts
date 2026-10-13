import { defineConfig, devices } from "@playwright/test";

// 127.0.0.1 everywhere (baseURL, preview host) so localhost resolving to ::1 can never make origins differ.
const baseURL = "http://127.0.0.1:4173";

// Expects `npm run build:e2e` to have run: Playwright does not build, and a stale dist-e2e is the one local pitfall.
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview -- --outDir dist-e2e --host 127.0.0.1 --port 4173 --strictPort",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
