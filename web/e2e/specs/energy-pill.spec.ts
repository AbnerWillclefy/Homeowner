import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp, visit } from "../pages/launch";
import { shell } from "../pages/shell";

// What this covers: the Energy pill in the top bar, on all four tabs. Before a Check-in it reads "Check-in" with a
// dashed edge; a tap opens the one Check-in dialog (focus on its title, Escape closes it, focus is back on the
// pill); saving updates the pill to the Energy number without a reload; a failed Check-in read gives an
// unavailable pill while the Streak still shows; on Today the pill alone opens the one dialog, which shows the planned
// Effort and the day's Restrictions; the targets are at
// least 2.75rem. Each test runs in pt-BR first, then en-US.

const LOCALES = [
  {
    locale: "pt-BR",
    unset: "Fazer check-in",
    energy: (n: number) => `Energia hoje: ${n}. Mudar check-in`,
    pending: (level: string) => `Check-in feito: ${level}. Mudar check-in`,
    unavailable: "Energia indisponível. Tentar de novo",
    streak: /^Sequência: /,
    normal: "Normal",
    save: "Salvar",
    cancel: "Cancelar",
    plannedLine: /^\d+ de 8 planejados$/,
    noRestrictions: "Nenhuma restrição hoje",
    wordmark: "Check-in",
  },
  {
    locale: "en-US",
    unset: "Check in",
    energy: (n: number) => `Energy today: ${n}. Change Check-in`,
    pending: (level: string) => `Checked in: ${level}. Change Check-in`,
    unavailable: "Energy unavailable. Try again",
    streak: /^Streak: /,
    normal: "Normal",
    save: "Save",
    cancel: "Cancel",
    plannedLine: /^\d+ of 8 planned$/,
    noRestrictions: "No restrictions today",
    wordmark: "Check-in",
  },
] as const;

const PATHS = ["/", "/chores", "/home", "/me"] as const;

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: signedInResident() });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      fakeApi.state.streak = 3;
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    const pill = (page: Page, name: string) => shell.topBar(page).getByRole("button", { name, exact: true });
    const dialog = (page: Page) => page.getByRole("dialog", { name: l.wordmark });

    for (const path of PATHS) {
      test(`before a Check-in the pill is dashed and says Check-in on ${path}`, async ({ page, baseURL }) => {
        await visit(page, new URL(path, baseURL!).toString());
        const button = pill(page, l.unset);
        await expect(button).toBeVisible();
        await expect(button).toContainText("Check-in");
        expect(await button.evaluate((el) => getComputedStyle(el).borderStyle)).toBe("dashed");
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        const bar = await shell.topBar(page).boundingBox();
        expect(box!.x + box!.width).toBeLessThanOrEqual(bar!.x + bar!.width + 1);
      });
    }

    test("a tap opens the dialog on Chores, Escape closes it and focus is back on the pill", async ({ page, baseURL }) => {
      await visit(page, new URL("/chores", baseURL!).toString());
      const button = pill(page, l.unset);
      await button.click();
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page).getByRole("heading", { name: l.wordmark })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();
      await expect(button).toBeFocused();
    });

    test("Cancel also returns focus to the pill, and the keyboard opens it with Enter", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const button = pill(page, l.unset);
      await expect(button).toBeVisible();
      await button.focus();
      await page.keyboard.press("Enter");
      await expect(dialog(page)).toBeVisible();
      await dialog(page).getByRole("button", { name: l.cancel, exact: true }).click();
      await expect(dialog(page)).toBeHidden();
      await expect(button).toBeFocused();
    });

    test("saving a Check-in turns the pill into the Energy number without a reload", async ({ page, baseURL }) => {
      await visit(page, new URL("/me", baseURL!).toString());
      await pill(page, l.unset).click();
      await dialog(page).getByRole("radio", { name: l.normal }).check({ force: true });
      await dialog(page).getByRole("button", { name: l.save, exact: true }).click();
      await expect(dialog(page)).toBeHidden();

      const done = pill(page, l.energy(9));
      await expect(done).toBeVisible();
      await expect(done).toHaveText("9", { useInnerText: true });
      expect(await done.evaluate((el) => getComputedStyle(el).borderStyle)).toBe("solid");
      await expect(done).toBeFocused();
      // The same page: nothing navigated.
      await expect(page).toHaveURL(/\/me$/);
    });

    test("on Today only the pill opens the one dialog; nothing else on the page does", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(pill(page, l.unset)).toBeVisible();
      // No Check-in card and no second button of that name in the page.
      await expect(page.getByRole("button", { name: l.unset, exact: true })).toHaveCount(1);
      await expect(page.getByRole("region", { name: l.wordmark })).toHaveCount(0);

      await pill(page, l.unset).click();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(dialog(page).getByRole("heading", { name: l.wordmark })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();
      await expect(pill(page, l.unset)).toBeFocused();
    });

    test("the dialog shows the planned Effort against Energy and the day's Restrictions once checked in", async ({ page, baseURL, fakeApi }) => {
      fakeApi.state.checkIn = { date: "2030-01-15", checkedIn: true, level: "normal", restrictions: [] };
      await launchApp(page, baseURL!);
      await pill(page, l.energy(8)).click();
      await expect(dialog(page).getByText(l.plannedLine)).toBeVisible();
      await expect(dialog(page).getByText(l.noRestrictions, { exact: true })).toBeVisible();
      await expect(dialog(page).getByRole("radio")).toHaveCount(4);
    });

    test("a Check-in read that failed gives the unavailable pill, and the Streak still shows", async ({ page, baseURL, fakeApi }) => {
      fakeApi.override("GET /home/check-in", json(500, { error: "boom" }));
      await visit(page, new URL("/chores", baseURL!).toString());
      const button = pill(page, l.unavailable);
      await expect(button).toBeVisible();
      await expect(shell.topBar(page).getByRole("button", { name: l.streak })).toBeVisible();

      // A tap tries again; the server has recovered.
      fakeApi.override("GET /home/check-in", json(200, { date: "2030-01-15", checkedIn: false, level: null, restrictions: [] }));
      await button.click();
      await expect(pill(page, l.unset)).toBeVisible();
    });

    test("checked in before the Allocation, the pill shows a check mark and Check-in, and names the level", async ({ page, baseURL, fakeApi }) => {
      fakeApi.state.checkIn = { date: "2030-01-15", checkedIn: true, level: "low", restrictions: [] };
      fakeApi.state.dayPlan = { ...fakeApi.state.dayPlan!, planned: false, energy: null, mine: [], others: [], pool: [] };
      await visit(page, new URL("/home", baseURL!).toString());
      const level = l.locale === "pt-BR" ? "Baixa" : "Low";
      await expect(pill(page, l.pending(level))).toBeVisible();
      await expect(pill(page, l.pending(level))).toHaveText("Check-in", { useInnerText: true });
      expect(await pill(page, l.pending(level)).evaluate((el) => getComputedStyle(el).borderStyle)).toBe("solid");
    });
  });
}
