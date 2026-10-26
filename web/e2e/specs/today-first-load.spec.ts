import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { todayHandlers } from "../mocks/handlers/today";
import { hold } from "../mocks/hold";
import { RESIDENT_EMAIL, signedInResident, withExplanation } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers: Today's first load shows its skeleton until the Check-in and the Day Plan have each
// answered, then everything in one swap (the Streak is in the top bar, which holds its box), and stays still (Cumulative Layout Shift under 0.1). In pt-BR first, then
// en-US, at a phone size and at 320px with 200% text, with the reads held long enough for the skeleton to show and
// answered at once (the skeleton never flashes). A failed read shows its own alert in place; a refresh of what is on
// screen keeps it.

const LOCALES = [
  {
    locale: "pt-BR",
    mine: "Suas tarefas",
    prompt: "Como você está hoje?",
    headline: "Um dia leve para você",
    streak: /^Sequência: /,
    pill: "Fazer check-in",
    retry: "Tentar de novo",
    today: "Hoje",
    chores: "Afazeres",
  },
  {
    locale: "en-US",
    mine: "Your Tasks",
    prompt: "How are you today?",
    headline: "A light day for you",
    streak: /^Streak: /,
    pill: "Check in",
    retry: "Try again",
    today: "Today",
    chores: "Chores",
  },
] as const;

const SIZES = [
  { name: "412px phone", viewport: { width: 412, height: 823 }, scale: false },
  { name: "320px at 200% text", viewport: { width: 320, height: 640 }, scale: true },
] as const;

const READS = /\/home\/(day-plan|check-in|streak)$/;
const SKELETON = '[data-testid="day-plan-skeleton"]';

declare global {
  interface Window {
    __cls: number;
    __skeletonShown: boolean;
  }
}

/** Sums every layout shift not caused by input, and notes whether the skeleton was ever visible (not `invisible`). */
async function observe(page: Page) {
  await page.addInitScript(() => {
    window.__cls = 0;
    window.__skeletonShown = false;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) window.__cls += shift.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new MutationObserver(() => {
      const skeleton = document.querySelector('[data-testid="day-plan-skeleton"]');
      if (skeleton && !skeleton.closest(".invisible")) window.__skeletonShown = true;
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  });
}

/** Largest text size: every size in the app is in rem, so the root font size scales the whole page. */
async function scaleText(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    });
  });
}

const cls = (page: Page) => page.evaluate(() => window.__cls);

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, fakeState: withExplanation(signedInResident(), "llm") });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      fakeApi.state.streak = 5;
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    const mine = (page: Page) => page.getByRole("heading", { level: 3, name: l.mine });
    const prompt = (page: Page) => page.getByText(l.prompt);
    const explanation = (page: Page) => page.getByRole("button", { name: l.headline });
    const streak = (page: Page) => page.getByRole("button", { name: l.streak });
    // Today's greeting is its first h2 (it changes with the hour, so it is matched by role alone; an sr-only "Today" h2 follows).
    const todayHeading = (page: Page) => page.getByRole("heading", { level: 2 }).first();
    const task = (page: Page) => page.getByText("Wash the dishes", { exact: true });
    const skeleton = (page: Page) => page.locator(SKELETON);

    for (const size of SIZES) {
      test.describe(size.name, () => {
        test.use({ viewport: size.viewport });

        test.beforeEach(async ({ page }) => {
          await observe(page);
          if (size.scale) await scaleText(page);
        });

        test("held reads: the skeleton shows, then Today swaps in once and nothing moves", async ({ page, baseURL }) => {
          const held = { checkIn: hold(page, /\/home\/check-in$/), plan: hold(page, /\/home\/day-plan$/), streak: hold(page, /\/home\/streak$/) };
          await launchApp(page, baseURL!);

          await expect(skeleton(page)).toBeVisible();
          await expect(todayHeading(page)).toHaveCount(0);
          await page.waitForTimeout(300);

          // Today's two reads, one at a time: Today shows nothing of them until the last has answered.
          // The Streak is not one of them; it is held the whole time and the bar keeps its box.
          held.checkIn.release();
          await page.waitForTimeout(150);
          await expect(prompt(page)).toHaveCount(0);
          await expect(mine(page)).toHaveCount(0);
          await expect(skeleton(page)).toBeVisible();
          held.plan.release();

          await expect(mine(page)).toBeVisible();
          // The same render brought everything, and took the skeleton away, while the flame still waits.
          await expect(prompt(page)).toBeVisible({ timeout: 0 });
          await expect(explanation(page)).toBeVisible({ timeout: 0 });
          await expect(task(page)).toBeVisible({ timeout: 0 });
          await expect(skeleton(page)).toHaveCount(0);
          await expect(streak(page)).toHaveCount(0);

          // The flame arrives in its reserved box in the bar.
          held.streak.release();
          await expect(streak(page)).toBeVisible();

          await page.waitForTimeout(500);
          expect(await cls(page)).toBeLessThan(0.1);
        });

        test("the Check-in held: the pill reserves its box from the first frame and fills it without moving the bar", async ({ page, baseURL }) => {
          const checkIn = hold(page, /\/home\/check-in$/);
          await launchApp(page, baseURL!);

          // The bar is up with the Streak while the Check-in is held; the pill's slot already has its final box.
          await expect(streak(page)).toBeVisible();
          await page.waitForTimeout(400);
          const slot = page.locator('[data-slot="energy"]');
          const loading = (await slot.boundingBox())!;
          const barLoading = (await page.getByTestId("top-bar").boundingBox())!;
          const flame = (await streak(page).boundingBox())!;
          expect(loading.width).toBeGreaterThanOrEqual(44);
          expect(loading.height).toBeGreaterThanOrEqual(44);
          await expect(page.getByTestId("top-bar").getByRole("button", { name: l.pill })).toHaveCount(0);

          checkIn.release();
          const pill = page.getByTestId("top-bar").getByRole("button", { name: l.pill });
          await expect(pill).toBeVisible();
          const loaded = (await slot.boundingBox())!;
          const barLoaded = (await page.getByTestId("top-bar").boundingBox())!;
          expect(loaded).toEqual(loading);
          expect(barLoaded).toEqual(barLoading);
          expect(await streak(page).boundingBox()).toEqual(flame);
          await page.waitForTimeout(500);
          expect(await cls(page)).toBeLessThan(0.1);
        });

        test("the Streak held alone: Today swaps in without it and nothing moves", async ({ page, baseURL }) => {
          const streakRead = hold(page, /\/home\/streak$/);
          await launchApp(page, baseURL!);

          await expect(mine(page)).toBeVisible();
          await expect(prompt(page)).toBeVisible();
          await expect(skeleton(page)).toHaveCount(0);
          await page.waitForTimeout(400);
          await expect(streak(page)).toHaveCount(0);

          streakRead.release();
          await expect(streak(page)).toBeVisible();
          await page.waitForTimeout(500);
          expect(await cls(page)).toBeLessThan(0.1);
        });

        test("fast reads: Today shows at once, the skeleton never flashes and nothing moves", async ({ page, baseURL, fakeApi }) => {
          await launchApp(page, baseURL!);

          await expect(mine(page)).toBeVisible();
          await expect(prompt(page)).toBeVisible();
          await expect(streak(page)).toBeVisible();
          await expect(skeleton(page)).toHaveCount(0);
          await page.waitForTimeout(500);

          expect(await page.evaluate(() => window.__skeletonShown)).toBe(false);
          expect(await cls(page)).toBeLessThan(0.1);
          expect(fakeApi.requests.filter((r) => READS.test(r.path))).toHaveLength(3);
        });
      });
    }

    test.describe("a read that fails", () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test("the Streak: no flame, and the rest of Today shows normally", async ({ page, baseURL, fakeApi }) => {
        fakeApi.override("GET /home/streak", json(500, { error: "boom" }));
        await launchApp(page, baseURL!);

        await expect(mine(page)).toBeVisible();
        await expect(prompt(page)).toBeVisible();
        await expect(task(page)).toBeVisible();
        await expect(streak(page)).toHaveCount(0);
        await expect(skeleton(page)).toHaveCount(0);
      });

      test("the Check-in: its own alert in place, with the Tasks shown", async ({ page, baseURL, fakeApi }) => {
        fakeApi.override("GET /home/check-in", json(500, { error: "boom" }));
        await launchApp(page, baseURL!);

        await expect(mine(page)).toBeVisible();
        await expect(page.getByRole("region", { name: "Check-in" }).getByRole("alert")).toBeVisible();
        await expect(task(page)).toBeVisible();
        await expect(streak(page)).toBeVisible();
        await expect(skeleton(page)).toHaveCount(0);
      });

      test("the Day Plan: its own alert in place, and Retry loads only that section", async ({ page, baseURL, fakeApi }) => {
        fakeApi.override("GET /home/day-plan", json(500, { error: "boom" }));
        await launchApp(page, baseURL!);

        await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
        await expect(prompt(page)).toBeVisible();
        await expect(streak(page)).toBeVisible();
        await expect(skeleton(page)).toHaveCount(0);

        // The server recovers. Retry draws the section's own skeleton, not the whole page's.
        fakeApi.use(todayHandlers);
        await page.getByRole("button", { name: l.retry }).click();
        await expect(mine(page)).toBeVisible();
        await expect(task(page)).toBeVisible();
        // The Check-in and the flame stayed where they were.
        await expect(prompt(page)).toBeVisible();
        await expect(streak(page)).toBeVisible();
      });
    });

    test("a refresh of data on screen keeps it and never brings the skeleton back", async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await launchApp(page, baseURL!);
      await expect(mine(page)).toBeVisible();

      // Held, so the refresh stays in flight; the fake only logs a request once it answers it.
      const refresh = hold(page, READS);
      const asked = page.waitForRequest(/\/home\/day-plan$/);
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
      await asked;

      await page.waitForTimeout(450);
      await expect(mine(page)).toBeVisible();
      await expect(task(page)).toBeVisible();
      await expect(skeleton(page)).toHaveCount(0);
      refresh.release();
      await expect(mine(page)).toBeVisible();
    });

    test("opening Today again with its data cached shows it at once and focus lands on the greeting", async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await launchApp(page, baseURL!);
      await expect(mine(page)).toBeVisible();

      const nav = page.getByRole("navigation");
      await nav.getByRole("link", { name: l.chores, exact: true }).click();
      await expect(page).toHaveURL(/\/chores$/);
      const reads = hold(page, READS);
      await nav.getByRole("link", { name: l.today, exact: true }).click();

      // The cached data shows with no skeleton while the refresh is held.
      await expect(mine(page)).toBeVisible();
      await expect(skeleton(page)).toHaveCount(0);
      await expect(todayHeading(page)).toBeFocused();
      reads.release();
    });
  });
}
