import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { hold } from "../mocks/hold";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { shell } from "../pages/shell";

// What this covers: the top bar above every tab (the logo as the page's one h1, the Streak on the right), the logo
// alone before the Home, focus on each tab's own heading, and a bar that keeps its height while the Streak loads.
// In pt-BR first, then en-US.

const LOCALES = [
  {
    locale: "pt-BR",
    streak: /^Sequência: /,
    tagline: "Gerencie os afazeres domésticos do seu lar.",
    tabs: ["Hoje", "Afazeres", "Lar", "Eu"],
  },
  {
    locale: "en-US",
    streak: /^Streak: /,
    tagline: "Manage the housework in your Home.",
    tabs: ["Today", "Chores", "Home", "Me"],
  },
] as const;

const SIZES = [
  { name: "412px phone", viewport: { width: 412, height: 823 }, scale: false },
  { name: "320px at 200% text", viewport: { width: 320, height: 640 }, scale: true },
] as const;

/** Largest text size: every size in the app is in rem, so the root font size scales the whole page. */
async function scaleText(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    });
  });
}

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale });

    test.describe("signed in with a Home", () => {
      test.use({ fakeState: signedInResident() });

      test.beforeEach(async ({ page, fakeApi }) => {
        fakeApi.use(signedInHandlers);
        fakeApi.state.streak = 5;
        await seedSession(page, { email: RESIDENT_EMAIL });
      });

      test("every tab has the bar: the logo on the left, the Streak on the right, no tagline", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        const nav = page.getByRole("navigation");
        for (const name of l.tabs) {
          await nav.getByRole("link", { name, exact: true }).click();
          const bar = shell.topBar(page);
          const streak = bar.getByRole("button", { name: l.streak });
          await expect(streak).toBeVisible();
          // One main heading on the page, and it is in the bar.
          await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
          await expect(bar.getByRole("heading", { level: 1, name: "homeowner", exact: true })).toBeVisible();
          const logoBox = await shell.logo(page).boundingBox();
          const streakBox = await streak.boundingBox();
          expect(logoBox!.x).toBeLessThan(streakBox!.x);
          expect(streakBox!.width).toBeGreaterThanOrEqual(44);
          expect(streakBox!.height).toBeGreaterThanOrEqual(44);
          await expect(page.getByText(l.tagline)).toHaveCount(0);
          // The Streak is no longer in Today's header, and no tab repeats it.
          await expect(page.getByRole("button", { name: l.streak })).toHaveCount(1);
        }
      });

      test("focus lands on the tab's own first heading, not on the logo", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        const nav = page.getByRole("navigation");
        // A first pass loads every tab; on the second each shows its heading at once.
        for (const pass of [1, 2]) {
          for (const name of l.tabs.slice(1)) {
            await nav.getByRole("link", { name, exact: true }).click();
            await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
            if (pass === 2) await expect(page.getByRole("heading", { level: 2 }).first()).toBeFocused();
          }
          await nav.getByRole("link", { name: l.tabs[0], exact: true }).click();
          await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
        }
      });

      for (const size of SIZES) {
        test.describe(size.name, () => {
          test.use({ viewport: size.viewport });

          test(`the bar keeps its box while the Streak loads (${size.name})`, async ({ page, baseURL }) => {
            if (size.scale) await scaleText(page);
            const streakRead = hold(page, /\/home\/streak$/);
            await launchApp(page, baseURL!);

            // The Home is ready and Today shows, while the Streak read is still held.
            await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
            await expect(shell.logo(page)).toBeVisible();
            await page.waitForTimeout(500);
            await expect(page.getByRole("button", { name: l.streak })).toHaveCount(0);
            const loading = (await shell.topBar(page).boundingBox())!;
            const logoLoading = (await shell.logo(page).boundingBox())!;

            streakRead.release();
            const streak = page.getByRole("button", { name: l.streak });
            await expect(streak).toBeVisible();
            const loaded = (await shell.topBar(page).boundingBox())!;
            const logoLoaded = (await shell.logo(page).boundingBox())!;

            expect(loaded.height).toBe(loading.height);
            expect(loaded.y).toBe(loading.y);
            expect(logoLoaded).toEqual(logoLoading);
            // The Streak never leaves the screen, even at the largest text.
            const streakBox = (await streak.boundingBox())!;
            expect(streakBox.x + streakBox.width).toBeLessThanOrEqual(size.viewport.width);
          });
        });
      }
    });

    test("signed out, the logo stands alone", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(page).toHaveURL(/\/signin$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(shell.logo(page)).toBeVisible();
      await expect(shell.topBar(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: l.streak })).toHaveCount(0);
      await expect(page.getByText(l.tagline)).toHaveCount(0);
    });
  });
}
