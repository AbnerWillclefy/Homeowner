import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { onboardingHandlers } from "../mocks/handlers/onboarding";
import { residentsHandlers } from "../mocks/handlers/residents";
import { todayHandlers } from "../mocks/handlers/today";
import { hold } from "../mocks/hold";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp, visit } from "../pages/launch";
import { shell } from "../pages/shell";
import { tabs } from "../pages/tabs";

// What this covers: the screens other than Today load on demand. While a screen's chunk is held, its skeleton shows
// only after 300ms (never a full-screen spinner), and the content replaces it when the chunk arrives. A chunk that
// comes back as HTML (what CloudFront answers for a file a deploy removed) reloads the app once, then shows the
// boundary's alert with Retry, and never reloads again. Service workers are blocked in Playwright, so opening
// each screen offline is a manual check (docs/architecture/web.md, Navigation).

const SKELETON_DELAY_MS = 300;

const skeleton = (page: Page) => page.getByTestId("lazy-skeleton");
const spinner = (page: Page) => page.getByRole("progressbar");

interface LazyScreen {
  name: string;
  chunk: RegExp;
  /** Gets the app to the point where only the screen's chunk is missing, and starts the navigation. */
  open(page: Page, baseURL: string): Promise<void>;
  loaded(page: Page): ReturnType<Page["getByRole"]>;
}

const SCREENS: LazyScreen[] = [
  {
    name: "Chores",
    chunk: /\/assets\/ChoresPage-[^/]+\.js$/,
    open: async (page, baseURL) => {
      await launchApp(page, baseURL);
      await expect(tabs.today.heading(page)).toBeVisible();
      await shell.openTab(page, "Chores");
    },
    loaded: (page) => tabs.chores.heading(page),
  },
  {
    name: "Home",
    chunk: /\/assets\/HomePage-[^/]+\.js$/,
    open: async (page, baseURL) => {
      await launchApp(page, baseURL);
      await expect(tabs.today.heading(page)).toBeVisible();
      await shell.openTab(page, "Home");
    },
    loaded: (page) => tabs.home.heading(page),
  },
  {
    name: "a Resident page",
    chunk: /\/assets\/ResidentRoute-[^/]+\.js$/,
    open: async (page) => {
      await visit(page, "/home/residents/resident-2");
    },
    loaded: (page) => page.getByRole("heading", { name: "Bruna Souza", level: 2 }),
  },
  {
    name: "Me",
    chunk: /\/assets\/MePage-[^/]+\.js$/,
    open: async (page, baseURL) => {
      await launchApp(page, baseURL);
      await expect(tabs.today.heading(page)).toBeVisible();
      await shell.openTab(page, "Me");
    },
    loaded: (page) => tabs.me.heading(page),
  },
  {
    name: "Me edit",
    chunk: /\/assets\/MeEdit-[^/]+\.js$/,
    open: async (page) => {
      await visit(page, "/me/edit");
    },
    loaded: (page) => page.getByRole("heading", { name: "Your name", level: 2 }),
  },
];

test.describe("a signed-in Resident", () => {
  test.use({ fakeState: signedInResident() });

  test.beforeEach(async ({ page, fakeApi }) => {
    fakeApi.use(signedInHandlers);
    await seedSession(page, { email: RESIDENT_EMAIL });
  });

  for (const screen of SCREENS) {
    test(`${screen.name}: a held chunk shows the skeleton after 300ms, with no spinner, then the content`, async ({ page, baseURL }) => {
      const held = hold(page, screen.chunk);
      const started = Date.now();
      await screen.open(page, baseURL!);

      await page.waitForTimeout(150);
      await expect(skeleton(page)).toHaveCount(0);

      await expect(skeleton(page)).toBeVisible();
      expect(Date.now() - started).toBeGreaterThanOrEqual(SKELETON_DELAY_MS);
      await expect(spinner(page)).toHaveCount(0);

      held.release();
      await expect(screen.loaded(page)).toBeVisible();
      await expect(skeleton(page)).toHaveCount(0);
    });
  }

  test("a chunk that arrives under 300ms shows no skeleton at all", async ({ page, baseURL }) => {
    await launchApp(page, baseURL!);
    await expect(tabs.today.heading(page)).toBeVisible();
    await shell.openTab(page, "Chores");

    await expect(tabs.chores.heading(page)).toBeVisible();
    await expect(skeleton(page)).toHaveCount(0);
  });

  test.describe("a chunk that comes back as HTML", () => {
    const html = { status: 200, contentType: "text/html", body: "<!doctype html><title>index</title>" };

    test("reloads the app once, then shows the alert with Retry and never reloads again", async ({ page, baseURL }) => {
      let loads = 0;
      page.on("load", () => (loads += 1));
      await page.route(/\/assets\/ChoresPage-[^/]+\.js$/, (route) => route.fulfill(html));

      await launchApp(page, baseURL!);
      await expect(tabs.today.heading(page)).toBeVisible();
      await shell.openTab(page, "Chores");

      const alert = page.getByRole("alert").filter({ hasText: "This screen could not be loaded." });
      await expect(alert).toBeVisible();
      await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
      // The first failure reloaded the app (a second load event); the second one stayed.
      expect(loads).toBe(2);
      await page.waitForTimeout(1000);
      expect(loads).toBe(2);
      // The rest of the app still works: the tabs are there.
      await expect(shell.nav(page)).toBeVisible();
    });

    test("Retry reloads, and a chunk that is back loads the screen", async ({ page, baseURL }) => {
      let broken = true;
      await page.route(/\/assets\/ChoresPage-[^/]+\.js$/, (route) => (broken ? route.fulfill(html) : route.fallback()));

      await launchApp(page, baseURL!);
      await expect(tabs.today.heading(page)).toBeVisible();
      await shell.openTab(page, "Chores");
      const alert = page.getByRole("alert").filter({ hasText: "This screen could not be loaded." });
      await expect(alert).toBeVisible();

      broken = false;
      await alert.getByRole("button", { name: "Try again" }).click();
      await expect(tabs.chores.heading(page)).toBeVisible();
    });
  });
});

test.describe("onboarding mid-walk", () => {
  test.use({ fakeState: { ...signedInResident(), home: null, onboardingStored: "reminders" } });

  test.beforeEach(async ({ page, fakeApi }) => {
    fakeApi.use(onboardingHandlers);
    // Launching on Today starts its reads at once; with no Home they answer "none" (ADR 0016).
    fakeApi.use(todayHandlers);
    fakeApi.use(residentsHandlers);
    await seedSession(page, { email: RESIDENT_EMAIL });
  });

  test("a held chunk shows the gradient frame, the loading line after 300ms and no spinner, then the step", async ({ page, baseURL }) => {
    const held = hold(page, /\/assets\/Onboarding-[^/]+\.js$/);
    const started = Date.now();
    await launchApp(page, baseURL!);

    await page.waitForTimeout(150);
    await expect(skeleton(page)).toHaveCount(0);

    await expect(skeleton(page)).toBeVisible();
    expect(Date.now() - started).toBeGreaterThanOrEqual(SKELETON_DELAY_MS);
    await expect(skeleton(page)).toContainText("Loading your setup");
    await expect(spinner(page)).toHaveCount(0);

    held.release();
    await expect(page.getByRole("heading", { name: "Your Baseline", level: 1 })).toBeVisible();
    await expect(skeleton(page)).toHaveCount(0);
  });
});
