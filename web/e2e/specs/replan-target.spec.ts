import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers: the staging-only "Replan now" button has a clear tappable area (nothing on top of it) of at
// least 24px in height (the Lighthouse `target-size` audit) and stays at least 2.75rem tall. It samples the button's
// box with `elementFromPoint` the way a finger would hit it, in pt-BR first and then en-US, at a phone size and at
// 320px with 200% text, as the page loads (not scrolled into view, as Lighthouse audits it) and after it is scrolled
// into view. It needs the build with Replan on, so it runs only in the `chromium-replan` project.

const LOCALES = [
  { locale: "pt-BR", replan: "Replanejar agora", mine: "Suas tarefas" },
  { locale: "en-US", replan: "Replan now", mine: "Your Tasks" },
] as const;

const SIZES = [
  { name: "412px phone", viewport: { width: 412, height: 823 }, scale: false },
  { name: "320px at 200% text", viewport: { width: 320, height: 640 }, scale: true },
] as const;

const STEP = 4;
const MIN_FREE = 24;

/** Largest text size: every size in the app is in rem, so the root font size scales the whole page. */
async function scaleText(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    });
  });
}

interface Reading {
  height: number;
  free: number;
  covers: string[];
}

/**
 * Walks down the button's box row by row (every STEP px, at the centre and at both side insets) and reports the
 * longest run of rows where every sample hits the button or something inside it, and what sits on top elsewhere.
 * A row below the fold has nothing on top of it yet, so it counts as free: the check as loaded is about what sits
 * over the button where it already shows.
 */
async function read(button: Locator): Promise<Reading> {
  return button.evaluate((el, step) => {
    const box = el.getBoundingClientRect();
    const covers = new Set<string>();
    let run = 0;
    let free = 0;
    for (let y = box.top + step / 2; y < box.bottom; y += step) {
      let clear = true;
      for (const x of [box.left + 4, box.left + box.width / 2, box.right - 4]) {
        if (y < 0 || y >= innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        // The button's own parents show through its rounded corners: that is not something on top of it.
        if (hit !== null && !el.contains(hit) && !hit.contains(el)) {
          clear = false;
          covers.add(`${hit.tagName.toLowerCase()}${hit.closest("nav") ? " (in the nav)" : ""}: ${hit.className}`);
        }
      }
      run = clear ? run + step : 0;
      free = Math.max(free, run);
    }
    return { height: box.height, free, covers: [...covers] };
  }, STEP);
}

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, fakeState: signedInResident() });

    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "chromium-replan", "needs the build with Replan on");
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    for (const size of SIZES) {
      test.describe(size.name, () => {
        test.use({ viewport: size.viewport });

        test("the button is at least 2.75rem tall and has 24px of height nothing covers", async ({ page, baseURL, fakeApi }) => {
          fakeApi.use(signedInHandlers);
          if (size.scale) await scaleText(page);
          await launchApp(page, baseURL!);
          await expect(page.getByRole("heading", { level: 3, name: l.mine })).toBeVisible();
          const button = page.getByRole("button", { name: l.replan });
          await expect(button).toBeVisible();
          const minHeight = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.75);

          // As loaded: where the page happens to leave the button, with the nav over whatever is at the fold.
          const loaded = await read(button);
          expect(loaded.height).toBeGreaterThanOrEqual(minHeight - 0.5);
          expect(loaded.covers, `as loaded, free ${loaded.free}px`).toEqual([]);
          expect(loaded.free).toBeGreaterThanOrEqual(MIN_FREE);

          await button.scrollIntoViewIfNeeded();
          const scrolled = await read(button);
          expect(scrolled.covers, `scrolled into view, free ${scrolled.free}px`).toEqual([]);
          expect(scrolled.free).toBeGreaterThanOrEqual(MIN_FREE);
        });

        test("as loaded, the button lies wholly above the bottom nav", async ({ page, baseURL, fakeApi }) => {
          // At 200% text Today is thousands of pixels tall and the button is far below any fold; Lighthouse audits
          // the phone size at its default text, and the other test covers the button once scrolled to.
          test.skip(size.scale, "the button is below the fold at the largest text size");
          // The sample Home is short; a shorter phone puts the fold where a fuller Today has it.
          await page.setViewportSize({ width: size.viewport.width, height: 560 });
          fakeApi.use(signedInHandlers);
          await launchApp(page, baseURL!);
          const button = page.getByRole("button", { name: l.replan });
          await expect(button).toBeVisible();

          // The sticky nav covers whatever lies at the fold, so Replan sits high on Today: its box ends before the
          // nav's begins, with the page at the top and nothing scrolled.
          const edges = await page.evaluate((el) => {
            const box = el.getBoundingClientRect();
            return { scrolled: scrollY, bottom: box.bottom, navTop: document.querySelector("nav")!.getBoundingClientRect().top };
          }, await button.elementHandle());
          expect(edges.scrolled).toBe(0);
          expect(edges.bottom, JSON.stringify(edges)).toBeLessThanOrEqual(edges.navTop);
        });
      });
    }
  });
}
