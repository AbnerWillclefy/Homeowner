import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { uncheckedDay } from "../mocks/handlers/today";
import { RESIDENT_EMAIL, signedInResident, withExplanation } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import type { FakeState } from "../mocks/api";
import type { PlanTask } from "../../src/domains/dayplan/api/api";

// The README screenshots: five screens per locale, a 390x844 phone, sample data only.
// Run with `npx playwright test -c playwright.readme.config.ts` after `npm run build:e2e`.

const OUT = "../docs/screenshots";

const LOCALES = [
  {
    locale: "pt-BR",
    file: "pt-BR",
    nav: { chores: "Afazeres", home: "Lar", me: "Eu" },
    chores: { "chore-1": "Lavar a louça", "chore-2": "Passar pano no chão", "chore-3": "Levar o lixo para fora" },
  },
  {
    locale: "en-US",
    file: "en",
    nav: { chores: "Chores", home: "Home", me: "Me" },
    chores: { "chore-1": "Wash the dishes", "chore-2": "Mop the floors", "chore-3": "Take out the trash" },
  },
] as const;

/** The sample Home, with a named Resident and the Chore names in the locale. */
function sample(names: Record<string, string>, checkedIn: boolean): FakeState {
  const state = withExplanation(signedInResident(), "llm");
  state.user = { ...state.user!, displayName: "Abner" };
  state.residents = state.residents?.map((r) => (r.you ? { ...r, name: "Abner" } : r));
  state.chores = state.chores.map((c) => ({ ...c, name: names[c.id] ?? c.name }));
  // Real allocator reasons, and a plan a visitor can trust: the Mop (bending) goes to Bruna, not to Abner, who
  // cannot bend.
  const plan = state.dayPlan!;
  const [dishes, mop] = plan.mine as [PlanTask, PlanTask];
  const trash = plan.others[0]!.tasks[0]!;
  const as = (t: PlanTask, reason: string, windowEnd = t.windowEnd): PlanTask => ({ ...t, reason, windowEnd, choreName: names[t.choreId] ?? t.choreName });
  plan.mine = [as(dishes, "liked"), as(trash, "deadline_today", "2030-01-15")];
  plan.others = [{ residentId: "resident-2", tasks: [as(mop, "lateness")] }];
  plan.pool = [];
  if (!checkedIn) state.checkIn = uncheckedDay();
  return state;
}

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
      // The fake plans 2030-01-15, so the app's clock reads that day too.
      await page.clock.setFixedTime(new Date("2030-01-15T10:30:00-03:00"));
    });

    test.describe("checked in", () => {
      test.use({ fakeState: sample(l.chores, true) });

      test("today, chores, home, me", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await expect(page.getByText(l.chores["chore-1"], { exact: true }).first()).toBeVisible();
        await page.screenshot({ path: `${OUT}/today-${l.file}.png` });

        for (const [tab, name] of [["chores", l.nav.chores], ["home", l.nav.home], ["me", l.nav.me]] as const) {
          await page.getByRole("link", { name, exact: true }).click();
          await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
          await page.waitForLoadState("networkidle");
          await page.screenshot({ path: `${OUT}/${tab}-${l.file}.png` });
        }
      });
    });

    test.describe("not checked in", () => {
      test.use({ fakeState: sample(l.chores, false) });

      test("check-in", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.waitForLoadState("networkidle");
        // The dialog focuses its title on open; drop the focus ring from the picture.
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.screenshot({ path: `${OUT}/checkin-${l.file}.png` });
      });
    });
  });
}
