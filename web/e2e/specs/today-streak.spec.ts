import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { hold } from "../mocks/hold";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { shell } from "../pages/shell";

// What this covers: the Streak as a flame button in the top bar's Streak slot. It opens a centred dialog and
// focus comes back to it on close (Close button and Escape), a Streak of 0 looks like any other number, a held
// Streak does not hold Today (the flame arrives in its reserved slot), a Streak that could not be read leaves no button, a failed
// refresh keeps the number, and the bar holds at 320px with three digits. No Streak card
// is left in the body. Each test runs in pt-BR first, then en-US.

const LOCALES = [
  {
    locale: "pt-BR",
    name: (count: number) => `Sequência: ${count} ${count === 1 ? "dia" : "dias"}`,
    streakName: /^Sequência: /,
    title: "Sua sequência",
    close: "Fechar",
    todayCounts: "Hoje conta",
    empty: "Conclua uma tarefa para começar uma",
    rules: [
      "Concluir uma tarefa no dia aumenta a sequência.",
      "Um dia sem tarefas assumidas, ou esgotado, pausa a sequência.",
      "Assumir tarefas e não concluir nenhuma quebra a sequência.",
      "Recusar ou ignorar uma tarefa proposta nunca quebra a sequência.",
    ],
  },
  {
    locale: "en-US",
    name: (count: number) => `Streak: ${count} ${count === 1 ? "day" : "days"}`,
    streakName: /^Streak: /,
    title: "Your Streak",
    close: "Close",
    todayCounts: "Today counts",
    empty: "Finish a Task to start one",
    rules: [
      "Finishing one Task in a day grows it.",
      "A day with nothing taken on, or a Drained day, pauses it.",
      "Taking on Tasks and finishing none breaks it.",
      "Refusing or ignoring a proposed Task never breaks it.",
    ],
  },
] as const;

// Today's title ("Your Tasks"): the tab's first h2.
const heading = (page: Page) => page.getByRole("heading", { level: 2 }).first();
const regainFocus = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({
      locale: l.locale,
      viewport: { width: 390, height: 844 },
      fakeState: (() => {
        const state = signedInResident();
        state.streak = 3;
        state.streakTodayGrew = true;
        return state;
      })(),
    });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
      await page.clock.setFixedTime(new Date("2030-01-14T15:00:00"));
    });

    const flame = (page: Page, count: number) => page.getByRole("button", { name: l.name(count), exact: true });

    test("the flame sits in the top bar after the logo, opens the dialog, and focus returns on Close and on Escape", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const button = flame(page, 3);
      await expect(button).toBeVisible();
      await expect(button).toContainText("3");
      await expect(shell.topBar(page).getByRole("button", { name: l.streakName })).toBeVisible();
      const logo = await shell.logo(page).boundingBox();
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThan(logo!.x + logo!.width - 1);
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await expect(button.locator("svg")).toHaveAttribute("aria-hidden", "true");

      await button.click();
      const dialog = page.getByRole("dialog", { name: l.title });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: l.title })).toBeFocused();
      await expect(dialog.getByText(l.todayCounts, { exact: true })).toBeVisible();
      for (const rule of l.rules) await expect(dialog.getByText(rule, { exact: true })).toBeVisible();
      await expect(dialog.getByRole("listitem")).toHaveCount(4);

      await dialog.getByRole("button", { name: l.close, exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(button).toBeFocused();

      await button.click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(button).toBeFocused();
    });

    test("the keyboard reaches the flame with Tab and Enter opens the dialog", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const button = flame(page, 3);
      await expect(button).toBeVisible();
      for (let i = 0; i < 10 && !(await button.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
      await expect(button).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: l.title })).toBeVisible();
    });

    test("there is no Streak card in the body", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(flame(page, 3)).toBeVisible();
      await expect(page.getByRole("region", { name: l.streakName })).toHaveCount(0);
      await expect(page.locator("main").getByText(l.todayCounts)).toHaveCount(0);
    });

    test.describe("a Streak of 0", () => {
      test.use({
        fakeState: (() => {
          const state = signedInResident();
          state.streak = 0;
          return state;
        })(),
      });

      test("looks like any number: the name says 0, the dialog shows the empty line", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        const button = flame(page, 0);
        await expect(button).toBeVisible();
        await expect(button).toContainText("0");
        expect(await button.evaluate((el) => el.className)).not.toMatch(/danger|accent|warning/);
        await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
        await button.click();
        const dialog = page.getByRole("dialog", { name: l.title });
        await expect(dialog.getByText(l.empty, { exact: true })).toBeVisible();
        await expect(dialog.getByText(l.todayCounts)).toHaveCount(0);
      });
    });

    test("while the Streak is held Today shows without it, and the flame arrives in the bar's reserved slot", async ({ page, baseURL }) => {
      const streak = hold(page, /\/home\/streak$/);
      await launchApp(page, baseURL!);
      // Today does not wait for the Streak: the title shows, the bar holds the flame's place.
      await expect(heading(page)).toBeVisible();
      await expect(page.getByTestId("day-plan-skeleton")).toHaveCount(0);
      await expect(shell.logo(page)).toBeVisible();
      await expect(page.getByRole("button", { name: l.streakName })).toHaveCount(0);

      streak.release();
      await expect(flame(page, 3)).toBeVisible();
    });

    test("a Streak that could not be read leaves no button and no alert", async ({ page, baseURL, fakeApi }) => {
      fakeApi.override("GET /home/streak", json(500, { error: "boom" }));
      await launchApp(page, baseURL!);
      await expect(heading(page)).toContainText(/\S/);
      await expect(page.getByText(l.rules[0]!)).toHaveCount(0);
      await expect(page.getByRole("button", { name: l.streakName })).toHaveCount(0);
      await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
      await expect(page.getByText("Wash the dishes", { exact: true })).toBeVisible();
    });

    test("a failed refresh keeps the last number", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await expect(flame(page, 3)).toBeVisible();
      fakeApi.override("GET /home/streak", json(500, { error: "boom" }), { once: true });
      // The launch read stays fresh for 5s (`useStreak`), and the clock is fixed: move it past that so focus refetches.
      await page.clock.setFixedTime(new Date("2030-01-14T15:00:10"));
      const answered = page.waitForResponse(/\/home\/streak$/);
      await regainFocus(page);
      expect((await answered).status()).toBe(500);
      await expect(flame(page, 3)).toBeVisible();
    });

    test.describe("320px with three digits", () => {
      test.use({
        viewport: { width: 320, height: 640 },
        fakeState: (() => {
          const state = signedInResident();
          state.user.displayName = "Maria Eduarda";
          state.streak = 100;
          return state;
        })(),
      });

      test("fits with no sideways scroll, and the button keeps its size inside the bar", async ({ page, baseURL }) => {
        await launchApp(page, baseURL!);
        const button = flame(page, 100);
        await expect(button).toBeVisible();
        await expect(heading(page)).toBeVisible();
        const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflows).toBe(false);
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        const bar = await shell.topBar(page).boundingBox();
        expect(box!.y).toBeGreaterThanOrEqual(bar!.y - 1);
        expect(box!.y + box!.height).toBeLessThanOrEqual(bar!.y + bar!.height + 1);
        expect(box!.x + box!.width).toBeLessThanOrEqual(320);
      });
    });
  });
}
