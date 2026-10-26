import type { Locator, Page } from "@playwright/test";
import type { DayPlan, PlanTask, SwapOffer } from "../../src/domains/dayplan/api/api";
import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { swapsHandlers } from "../mocks/handlers/swaps";
import { tasksHandlers } from "../mocks/handlers/tasks";
import { FAKE_TODAY } from "../mocks/handlers/today";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers: an action on Today leaves the Resident's scroll position where it was, in pt-BR and then
// en-US. Accept, Accept all, Refuse, Take, Complete and the Swap answers each run on a button scrolled to the
// middle of a short screen; afterwards `window.scrollY` is exactly what it was and the Today heading has focus
// (the pressed button went away with its card). Offering a Swap goes through the dialog and ends the same way.
// When focus is still on something that survives the action, it stays there.
// The plan is tall on purpose: six of your Tasks, three of Bruna's and four in the pool.

const LOCALES = [
  {
    locale: "pt-BR",
    accept: (task: string) => `Aceitar ${task}`,
    refuse: (task: string) => `Recusar ${task}`,
    take: (task: string) => `Pegar ${task}`,
    done: (task: string) => `Concluir ${task}`,
    swap: (task: string) => `Trocar ${task}`,
    acceptAll: /^Aceitar todas as \d+ tarefas$/,
    acceptSwap: "Aceitar troca",
    declineSwap: "Recusar troca",
    cancelSwap: "Cancelar troca",
    doneHeading: "Concluídas hoje",
    committed: "Assumida",
    stale: /As tarefas mudaram/,
    submit: "Oferecer troca",
    dialogTitle: "O que você vai dar?",
    outgoing: "Suas ofertas de troca",
  },
  {
    locale: "en-US",
    accept: (task: string) => `Accept ${task}`,
    refuse: (task: string) => `Refuse ${task}`,
    take: (task: string) => `Take ${task}`,
    done: (task: string) => `Done with ${task}`,
    swap: (task: string) => `Swap ${task}`,
    acceptAll: /^Accept all \d+ Tasks$/,
    acceptSwap: "Accept swap",
    declineSwap: "Decline swap",
    cancelSwap: "Cancel swap",
    doneHeading: "Done today",
    committed: "Committed",
    stale: /The Tasks changed/,
    submit: "Offer swap",
    dialogTitle: "What will you give?",
    outgoing: "Your offers",
  },
] as const;

const task = (id: string, name: string, extra: Partial<PlanTask> = {}): PlanTask => ({
  id,
  choreId: `chore-${id}`,
  choreName: name,
  windowStart: "2030-01-14",
  windowEnd: "2030-01-16",
  currentEffort: 2,
  baseEffort: 2,
  importance: "normal",
  people: 1,
  reason: "due",
  category: "kitchen",
  ...extra,
});

const MINE = ["Mine 1", "Mine 2", "Mine 3", "Mine 4", "Mine 5", "Mine 6"];
const THEIRS = ["Theirs 1", "Theirs 2", "Theirs 3"];
const POOL = ["Pool 1", "Pool 2", "Pool 3", "Pool 4"];

/** A tall planned day. Mine 4 to 6 are Committed; Mine 1 to 3 are Proposed. Pool 3 suggests a two-person Task. */
function tallDay(): DayPlan {
  return {
    date: FAKE_TODAY,
    allocationTime: "07:00",
    planned: true,
    rejected: false,
    allocator: "template",
    energy: 20,
    mine: MINE.map((name, i) => task(`m${i + 1}`, name, i >= 3 ? { committed: true } : {})),
    others: [{ residentId: "resident-2", tasks: THEIRS.map((name, i) => task(`o${i + 1}`, name)) }],
    pool: POOL.map((name, i) => task(`p${i + 1}`, name, { reason: "no_energy_left", ...(i === 2 ? { suggestTwoPerson: true } : {}) })),
    doneToday: [],
    swaps: { incoming: [], outgoing: [] },
  };
}

const open = ({ reason: _reason, committed: _committed, ...rest }: PlanTask): PlanTask => rest;
const offer = (id: string, offered: PlanTask, requested: PlanTask): SwapOffer => ({
  id,
  residentId: "resident-2",
  offered: open(offered),
  requested: open(requested),
});

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

const topOf = (locator: Locator) => locator.evaluate((element) => element.getBoundingClientRect().top);

/**
 * Scrolls `button` to the middle of the screen, presses it and returns the scroll position before the press.
 * `expectStill` then checks the Today heading has focus, as the button went with its card, and the page has not moved.
 */
async function press(page: Page, button: Locator): Promise<number> {
  await button.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const before = await scrollY(page);
  // A short screen and a tall plan: a position of 0 would prove nothing.
  expect(before).toBeGreaterThan(100);
  await button.click();
  return before;
}

async function expectStill(page: Page, before: number) {
  await expect(page.locator("#today-heading")).toBeFocused();
  expect(await scrollY(page)).toBe(before);
}

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 600 }, fakeState: signedInResident() });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      fakeApi.use(tasksHandlers);
      fakeApi.use(swapsHandlers);
      fakeApi.state.dayPlan = tallDay();
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    const byName = (page: Page, name: string | RegExp) => page.getByRole("button", { name });
    const listItem = (page: Page, task: string) => page.getByRole("listitem").filter({ hasText: task });

    test("completing a Committed Task keeps the scroll position", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const before = await press(page, byName(page, l.done("Mine 5")));
      await expect(page.getByRole("heading", { level: 3, name: new RegExp(l.doneHeading) })).toBeVisible();
      await expect(byName(page, l.done("Mine 5"))).toHaveCount(0);
      await expectStill(page, before);
    });

    test("accepting a Proposed Task keeps the scroll position", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const before = await press(page, byName(page, l.accept("Mine 2")));
      await expect(listItem(page, "Mine 2").getByText(l.committed, { exact: true })).toBeVisible();
      await expectStill(page, before);
    });

    test("Accept all keeps the scroll position", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const before = await press(page, byName(page, l.acceptAll));
      await expect(byName(page, l.acceptAll)).toHaveCount(0);
      await expectStill(page, before);
    });

    test("refusing a Proposed Task keeps the scroll position", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const before = await press(page, byName(page, l.refuse("Mine 2")));
      await expect(byName(page, l.refuse("Mine 2"))).toHaveCount(0);
      await expect(byName(page, l.take("Mine 2"))).toBeVisible();
      await expectStill(page, before);
    });

    test("taking a Task from the pool keeps the scroll position", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      // Taking adds a card to Your Tasks, above the screen. Chromium's scroll anchoring then moves `scrollY` by that
      // card's height to keep what the Resident is looking at still, so the exact check is that Pool 1, the card
      // above the one taken, stays at the same place on screen. The heading's focus must not scroll anything more.
      // Within a pixel: the browser keeps whole-pixel scroll offsets while the rem-based layout has fractions.
      const pool1 = listItem(page, "Pool 1");
      const take = byName(page, l.take("Pool 2"));
      await take.evaluate((element) => element.scrollIntoView({ block: "center" }));
      const top = await topOf(pool1);
      await take.click();
      await expect(take).toHaveCount(0);
      await expect(byName(page, l.done("Pool 2"))).toBeVisible();
      await expect(page.locator("#today-heading")).toBeFocused();
      expect(Math.abs((await topOf(pool1)) - top)).toBeLessThan(1);
    });

    test("a stale answer keeps the scroll position too", async ({ page, baseURL, fakeApi }) => {
      fakeApi.override(
        "POST /home/tasks/{id}/complete",
        (_, state) => {
          state.dayPlan!.mine = state.dayPlan!.mine.filter((candidate) => candidate.id !== "m5");
          return json(409, { error: "already_done" });
        },
        { once: true },
      );
      await launchApp(page, baseURL!);
      // The calm status line appears at the top of the section, above the screen. Chromium's scroll anchoring moves
      // `scrollY` by its height to keep what the Resident is looking at still, so the exact check is that Mine 4,
      // the card above the one that went, stays at the same place on screen.
      const mine4 = listItem(page, "Mine 4");
      const done = byName(page, l.done("Mine 5"));
      await done.evaluate((element) => element.scrollIntoView({ block: "center" }));
      const top = await topOf(mine4);
      await done.click();
      await expect(done).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: /\S/ })).toBeVisible();
      await expect(page.locator("#today-heading")).toBeFocused();
      expect(await topOf(mine4)).toBe(top);
    });

    test("accepting a Swap keeps the scroll position", async ({ page, baseURL, fakeApi }) => {
      const plan = fakeApi.state.dayPlan!;
      plan.swaps.incoming = [
        offer("swap-in-1", plan.others[0]!.tasks[0]!, plan.mine[0]!),
        offer("swap-in-2", plan.others[0]!.tasks[1]!, plan.mine[1]!),
        offer("swap-in-3", plan.others[0]!.tasks[2]!, plan.mine[2]!),
      ];
      await launchApp(page, baseURL!);
      const before = await press(page, byName(page, new RegExp(`^${l.acceptSwap}`)).last());
      await expect(byName(page, new RegExp(`^${l.acceptSwap}`))).toHaveCount(2);
      await expectStill(page, before);
    });

    test("declining a Swap keeps the scroll position", async ({ page, baseURL, fakeApi }) => {
      const plan = fakeApi.state.dayPlan!;
      plan.swaps.incoming = [
        offer("swap-in-1", plan.others[0]!.tasks[0]!, plan.mine[0]!),
        offer("swap-in-2", plan.others[0]!.tasks[1]!, plan.mine[1]!),
        offer("swap-in-3", plan.others[0]!.tasks[2]!, plan.mine[2]!),
      ];
      await launchApp(page, baseURL!);
      const before = await press(page, byName(page, new RegExp(`^${l.declineSwap}`)).last());
      await expect(byName(page, new RegExp(`^${l.declineSwap}`))).toHaveCount(2);
      await expectStill(page, before);
    });

    test("cancelling your Swap offer keeps the scroll position", async ({ page, baseURL, fakeApi }) => {
      const plan = fakeApi.state.dayPlan!;
      plan.swaps.outgoing = [
        offer("swap-out-1", plan.mine[4]!, plan.others[0]!.tasks[0]!),
        offer("swap-out-2", plan.mine[5]!, plan.others[0]!.tasks[1]!),
      ];
      await launchApp(page, baseURL!);
      const before = await press(page, byName(page, new RegExp(`^${l.cancelSwap}`)).last());
      await expect(byName(page, new RegExp(`^${l.cancelSwap}`))).toHaveCount(1);
      await expectStill(page, before);
    });

    test("offering a Swap through the dialog keeps the scroll position and ends on the Today heading", async ({ page, baseURL, fakeApi }) => {
      // An offer already exists, so "Your offers" is in the page before and after: only its card count changes.
      const plan = fakeApi.state.dayPlan!;
      plan.swaps.outgoing = [offer("swap-out-1", plan.mine[5]!, plan.others[0]!.tasks[0]!)];
      await launchApp(page, baseURL!);
      const before = await press(page, byName(page, l.swap("Theirs 3")));
      const dialog = page.getByRole("dialog", { name: l.dialogTitle });
      await expect(dialog).toBeVisible();
      await dialog.locator("label").filter({ hasText: "Mine 5" }).click();
      await dialog.getByRole("button", { name: l.submit }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 3, name: l.outgoing })).toBeVisible();
      await expect(byName(page, l.swap("Theirs 3"))).toHaveCount(0);
      await expectStill(page, before);
    });

    test("focus that is still inside the section stays where it is", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      // Pool 3's link to its Chore is not a button, so it is not disabled while the action runs.
      const link = listItem(page, "Pool 3").getByRole("link");
      await link.evaluate((element) => element.scrollIntoView({ block: "center" }));
      await link.focus();
      const before = await scrollY(page);
      expect(before).toBeGreaterThan(100);
      // A click from the page's own script, so the pointer does not move focus to the button.
      // Pool 4 sits below the link, so nothing above it changes height (that would make Chromium re-anchor).
      await byName(page, l.done("Pool 4")).evaluate((element) => (element as HTMLElement).click());
      await expect(byName(page, l.done("Pool 4"))).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 3, name: new RegExp(l.doneHeading) })).toBeVisible();
      await expect(link).toBeFocused();
      expect(await scrollY(page)).toBe(before);
    });
  });
}
