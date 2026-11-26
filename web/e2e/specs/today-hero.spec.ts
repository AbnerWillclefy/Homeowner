import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { uncheckedDay } from "../mocks/handlers/today";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp, visit } from "../pages/launch";
import { shell } from "../pages/shell";

// What this covers: Today's hero card (the other tabs have none), in both locales. Before a Check-in it asks the
// Energy level as four large choices; picking one opens the one Check-in dialog with that level ticked and saves
// nothing (the Restrictions step is still asked); saving turns the card into the Energy chip with "N de M feitas" and
// the progress bar, without a reload. The chip and "Alguma restrição só hoje?" open the same dialog, and Escape or
// "Agora não" return focus to the card. A failed Check-in read says so on the card, with Retry, while the Streak still
// shows. The card never reads "0 de 0". The Streak and the microphone are in the header's tools, not the card.

const LOCALES = [
  {
    locale: "pt-BR",
    label: "Seu dia",
    question: "Como está a sua energia hoje?",
    normal: "Normal",
    low: "Baixa",
    chip: "Energia: baixa. Mudar",
    chipNormal: "Energia: normal. Mudar",
    progress: (done: number, total: number) => `${done} de ${total} ${total === 1 ? "feita" : "feitas"}`,
    restrictions: "Alguma restrição só hoje?",
    unavailable: "Energia indisponível.",
    retry: "Tentar de novo",
    streak: /^Sequência: /,
    save: "Salvar",
    cancel: "Agora não",
    plannedLine: /^\d+ de 8 planejados$/,
    noRestrictions: "Nenhuma restrição hoje",
    wordmark: "Check-in",
  },
  {
    locale: "en-US",
    label: "Your day",
    question: "How is your Energy today?",
    normal: "Normal",
    low: "Low",
    chip: "Energy: low. Change",
    chipNormal: "Energy: normal. Change",
    progress: (done: number, total: number) => `${done} of ${total} done`,
    restrictions: "Any Restriction just for today?",
    unavailable: "Energy unavailable.",
    retry: "Try again",
    streak: /^Streak: /,
    save: "Save",
    cancel: "Not now",
    plannedLine: /^\d+ of 8 planned$/,
    noRestrictions: "No restrictions today",
    wordmark: "Check-in",
  },
] as const;

const OTHER_PATHS = ["/chores", "/home", "/me"] as const;

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    // An unchecked day: the fake's default is checked in. On Today the dialog then opens by itself on launch
    // (see checkin-launch.spec.ts); the tests here that need the bare card on Today close it first.
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: { ...signedInResident(), checkIn: uncheckedDay() } });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      fakeApi.state.streak = 3;
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    const dialog = (page: Page) => page.getByRole("dialog", { name: l.wordmark });
    const hero = (page: Page) => page.getByRole("region", { name: l.label });
    // A choice is named by its level then its hint, so match the level at the start: "Normal" must not find "Energizado".
    const choice = (page: Page, name: string) => hero(page).getByRole("radio", { name: new RegExp(`^${name} `) });
    const chip = (page: Page, name: string = l.chip) => hero(page).getByRole("button", { name, exact: true });

    /** Today after the dialog it opens by itself has been closed, so the bare hero card asks the question. */
    async function openToday(page: Page, baseURL: string) {
      await launchApp(page, baseURL);
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();
    }

    test("before a Check-in the card asks the four levels as large choices", async ({ page, baseURL }) => {
      await openToday(page, baseURL!);
      await expect(hero(page).getByRole("radiogroup", { name: l.question })).toBeVisible();
      await expect(hero(page).getByRole("radio")).toHaveCount(4);
      for (const radio of await hero(page).locator("label").all()) {
        expect((await radio.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      // No chip and no figure until there is a Check-in.
      await expect(hero(page).getByRole("button", { name: /^(Energia|Energy): / })).toHaveCount(0);
      await expect(hero(page).getByRole("progressbar")).toHaveCount(0);
    });

    for (const path of OTHER_PATHS) {
      test(`${path} has no hero card, only Today does`, async ({ page, baseURL }) => {
        await visit(page, new URL(path, baseURL!).toString());
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(hero(page)).toHaveCount(0);
        await expect(shell.todayTools(page)).toHaveCount(0);
      });
    }

    test("picking a level opens the dialog with it ticked and saves nothing; Escape returns focus to the card", async ({ page, baseURL, fakeApi }) => {
      await openToday(page, baseURL!);
      await choice(page, l.normal).click({ force: true });
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page).getByRole("radio", { name: new RegExp(`^${l.normal}`) })).toBeChecked();
      // The Restrictions step is still asked, and nothing was sent.
      await expect(dialog(page).getByText(l.noRestrictions, { exact: true })).toBeVisible();
      expect(fakeApi.requests.filter((r) => r.method === "PUT")).toHaveLength(0);
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();
      expect(fakeApi.requests.filter((r) => r.method === "PUT")).toHaveLength(0);
      await expect(hero(page)).toBeFocused();
      // Still unchecked: the question is still there.
      await expect(hero(page).getByRole("radiogroup", { name: l.question })).toBeVisible();
    });

    test("the Restrictions link opens the dialog with no level ticked", async ({ page, baseURL }) => {
      await openToday(page, baseURL!);
      await hero(page).getByRole("button", { name: l.restrictions, exact: true }).click();
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page).getByRole("radio", { checked: true })).toHaveCount(0);
      await dialog(page).getByRole("button", { name: l.cancel, exact: true }).click();
      await expect(dialog(page)).toBeHidden();
      await expect(hero(page)).toBeFocused();
    });

    test("saving the picked level turns the card into the chip with the count, without a reload", async ({ page, baseURL }) => {
      await openToday(page, baseURL!);
      await choice(page, l.normal).click({ force: true });
      await dialog(page).getByRole("button", { name: l.save, exact: true }).click();
      await expect(dialog(page)).toBeHidden();

      await expect(chip(page, l.chipNormal)).toBeVisible();
      await expect(hero(page).getByText(l.progress(0, 2), { exact: true })).toBeVisible();
      await expect(hero(page).getByRole("progressbar", { name: l.label })).toHaveAttribute("aria-valuetext", l.progress(0, 2));
      await expect(hero(page)).toBeFocused();
      await expect(page).toHaveURL(/\/$/);
    });

    test("checked in: the chip reopens the one dialog, and Not now returns focus to the chip", async ({ page, baseURL, fakeApi }) => {
      fakeApi.state.checkIn = { date: "2030-01-15", checkedIn: true, level: "low", restrictions: [] };
      await launchApp(page, baseURL!);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(chip(page)).toHaveText(l.low);
      await chip(page).click();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(dialog(page).getByRole("heading", { name: l.wordmark })).toBeFocused();
      await expect(dialog(page).getByText(l.plannedLine)).toBeVisible();
      await expect(dialog(page).getByRole("radio", { name: l.low })).toBeChecked();
      await dialog(page).getByRole("button", { name: l.cancel, exact: true }).click();
      await expect(dialog(page)).toBeHidden();
      await expect(chip(page)).toBeFocused();
    });

    test("counts the done Tasks against the done plus the open ones, and the bar says so", async ({ page, baseURL, fakeApi }) => {
      fakeApi.state.checkIn = { date: "2030-01-15", checkedIn: true, level: "low", restrictions: [] };
      const plan = fakeApi.state.dayPlan!;
      fakeApi.state.dayPlan = { ...plan, mine: plan.mine.slice(0, 1), doneToday: [{ id: "task-9", choreName: "Mop the floors", completedAt: "2030-01-15T12:00:00Z", with: [] }] };
      await launchApp(page, baseURL!);
      await expect(hero(page).getByText(l.progress(1, 2), { exact: true })).toBeVisible();
      await expect(hero(page).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
      await expect(hero(page).getByRole("progressbar")).toHaveAttribute("aria-valuemax", "2");
    });

    test("with no plan yet the card shows the chip and never 0 of 0", async ({ page, baseURL, fakeApi }) => {
      fakeApi.state.checkIn = { date: "2030-01-15", checkedIn: true, level: "low", restrictions: [] };
      fakeApi.state.dayPlan = { ...fakeApi.state.dayPlan!, planned: false, energy: null, mine: [], others: [], pool: [] };
      await launchApp(page, baseURL!);
      await expect(chip(page)).toBeVisible();
      await expect(hero(page).getByRole("progressbar")).toHaveCount(0);
      await expect(hero(page)).not.toContainText(/0 (de|of) 0/);
    });

    test("a Check-in read that failed says so on the card, Retry recovers, and the Streak still shows", async ({ page, baseURL, fakeApi }) => {
      fakeApi.override("GET /home/check-in", json(500, { error: "boom" }));
      await launchApp(page, baseURL!);
      await expect(hero(page).getByRole("alert")).toHaveText(l.unavailable);
      await expect(shell.todayTools(page).getByRole("button", { name: l.streak })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // The server has recovered.
      fakeApi.override("GET /home/check-in", json(200, { date: "2030-01-15", checkedIn: false, level: null, restrictions: [] }));
      await hero(page).getByRole("button", { name: l.retry, exact: true }).click();
      // An unchecked day on Today: the dialog opens by itself once the read answers.
      await expect(dialog(page)).toBeVisible();
    });
  });
}
