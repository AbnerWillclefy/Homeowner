import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { tabs } from "../pages/tabs";

// What this covers, in pt-BR and English: the Me tab's rows (Baseline, Preferences, Restrictions, Language,
// Appearance, Account), each opening a Sheet and not a collapsible card; focus back on the row when the Sheet
// closes; every change sent at once with Desfazer in a toast that writes the old value back (a Baseline day, a
// Restriction, Appearance, Language); and the toast on a lasting Restriction that says its Responsibilities do not
// come back. Labels are per locale because rows are found by role and name.

const LOCALES = [
  {
    locale: "pt-BR",
    me: "Eu",
    rows: ["Energia base", "Preferências", "Restrições", "Idioma", "Aparência", "Conta"],
    baseline: "Energia base",
    restrictions: "Restrições",
    appearance: "Aparência",
    language: "Idioma",
    monday: "segunda-feira",
    low: "Baixa",
    normal: "Normal",
    bending: "Abaixar-se",
    heights: "Altura",
    twoRestrictions: "2 restrições",
    saved: "Salvo.",
    undo: "Desfazer",
    added: "Restrição adicionada. As responsabilidades removidas não voltam.",
    dark: "Escuro",
    otherLanguage: "English",
    otherLanguageRow: "Language",
    ownLanguage: "Português",
  },
  {
    locale: "en-US",
    me: "Me",
    rows: ["Baseline", "Preferences", "Restrictions", "Language", "Appearance", "Account"],
    baseline: "Baseline",
    restrictions: "Restrictions",
    appearance: "Appearance",
    language: "Language",
    monday: "Monday",
    low: "Low",
    normal: "Normal",
    bending: "Bending",
    heights: "Heights",
    twoRestrictions: "2 restrictions",
    saved: "Saved.",
    undo: "Undo",
    added: "Restriction added. Responsibilities it removed do not come back.",
    dark: "Dark",
    otherLanguage: "Português",
    otherLanguageRow: "Idioma",
    ownLanguage: "English",
  },
] as const;

// The toast sits outside the open Sheet, so the Sheet's modal hides it from the accessibility tree: find its button by markup.
const undoButton = (page: Page, name: string) => page.locator('[data-slot="toast"]').getByText(name, { exact: true });

const requests = (fakeApi: { requests: { method: string; path: string; body?: unknown }[] }, method: string, path: string) =>
  fakeApi.requests.filter((r) => r.method === method && r.path === path);

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: signedInResident() });

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
      await launchApp(page, baseURL!);
      await page.getByRole("navigation").getByRole("link", { name: l.me, exact: true }).click();
    });

    test("every setting is a row that opens a Sheet, not a card that expands", async ({ page }) => {
      await expect(page.getByRole("dialog")).toHaveCount(0);
      for (const name of l.rows) {
        const row = tabs.me.row(page, name);
        await expect(row).toBeVisible();
        await expect(row).toHaveAttribute("aria-haspopup", "dialog");
        await expect(row).not.toHaveAttribute("aria-expanded", /.*/);
      }
      await tabs.me.open(page, l.baseline);
      await expect(page.getByRole("dialog")).toHaveCount(1);
    });

    test("Escape closes the Sheet and focus returns to its row", async ({ page }) => {
      await tabs.me.open(page, l.restrictions);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(tabs.me.row(page, l.restrictions)).toBeFocused();
    });

    test("a Baseline day is sent at once and Desfazer sends the old value back for that day only", async ({ page, fakeApi }) => {
      await tabs.me.open(page, l.baseline);
      const monday = tabs.me.day(page, l.monday);
      await monday.getByRole("radio", { name: l.low, exact: true }).click();
      await expect(monday.getByRole("radio", { name: l.low, exact: true })).toBeChecked();
      await expect(page.getByText(l.saved, { exact: true })).toBeVisible();
      expect(requests(fakeApi, "PUT", "/me/baseline").map((r) => r.body)).toEqual([{ monday: 4 }]);

      await undoButton(page, l.undo).click();
      await expect(monday.getByRole("radio", { name: l.normal, exact: true })).toBeChecked();
      expect(requests(fakeApi, "PUT", "/me/baseline").map((r) => r.body)).toEqual([{ monday: 4 }, { monday: 8 }]);
    });

    test("a Restriction is sent at once, saved with Desfazer, and Desfazer removes it", async ({ page, fakeApi }) => {
      await tabs.me.open(page, l.restrictions);
      const heights = page.getByRole("switch", { name: l.heights });
      await heights.click();
      await expect(heights).toBeChecked();
      expect(requests(fakeApi, "PUT", "/me/restrictions/heights")).toHaveLength(1);

      await undoButton(page, l.undo).click();
      await expect(heights).not.toBeChecked();
      expect(requests(fakeApi, "DELETE", "/me/restrictions/heights")).toHaveLength(1);
    });

    test.describe("with two Restrictions", () => {
      const state = signedInResident();
      state.profile.restrictions = ["heights", "bending"];
      test.use({ fakeState: state });

      test("the Restrictions row shows a count, not a caption the row would cut", async ({ page }) => {
        await expect(tabs.me.row(page, l.restrictions)).toContainText(l.twoRestrictions);
      });
    });

    test.describe("with a Chore this Resident is Responsible for", () => {
      const state = signedInResident();
      state.profile.restrictions = [];
      state.chores.find((chore) => chore.id === "chore-2")!.responsibleResidentId = "resident-1";
      test.use({ fakeState: state });

      test("adding a lasting Restriction says the removed Responsibilities do not come back, and Desfazer does not give them back", async ({ page, fakeApi }) => {
        await tabs.me.open(page, l.restrictions);
        await page.getByRole("switch", { name: l.bending }).click();
        await expect(page.getByText(l.added, { exact: true })).toBeVisible();
        expect(fakeApi.state.chores.find((chore) => chore.id === "chore-2")!.responsibleResidentId).toBeNull();

        await undoButton(page, l.undo).click();
        await expect(page.getByRole("switch", { name: l.bending })).not.toBeChecked();
        expect(requests(fakeApi, "DELETE", "/me/restrictions/bending")).toHaveLength(1);
        expect(fakeApi.state.chores.find((chore) => chore.id === "chore-2")!.responsibleResidentId).toBeNull();
      });
    });

    test("Appearance applies at once and Desfazer flips it back without a reload", async ({ page }) => {
      await page.evaluate(() => ((window as unknown as { alive: boolean }).alive = true));
      const html = page.locator("html");
      const before = await html.getAttribute("data-theme");
      expect(before).not.toBe("dark");
      await tabs.me.open(page, l.appearance);
      await page.getByRole("radio", { name: l.dark, exact: true }).click();
      await expect(html).toHaveAttribute("data-theme", "dark");

      await undoButton(page, l.undo).click();
      await expect(html).toHaveAttribute("data-theme", before!);
      expect(await page.evaluate(() => (window as unknown as { alive?: boolean }).alive)).toBe(true);
      expect(await page.evaluate(() => localStorage.getItem("homeowner.theme"))).not.toBe("dark");
    });

    test("Language switches at once, and Desfazer, now worded in the new language, writes the old one back", async ({ page }) => {
      await tabs.me.open(page, l.language);
      await page.getByRole("radio", { name: l.otherLanguage, exact: true }).click();
      await expect(tabs.me.sheet(page, l.otherLanguageRow)).toBeVisible();

      const undo = otherUndo(l.locale);
      await undoButton(page, undo).click();
      await expect(tabs.me.sheet(page, l.language)).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", l.locale);
    });
  });
}

/** Desfazer after the language switched is in the other language. */
function otherUndo(locale: string): string {
  return locale === "pt-BR" ? "Undo" : "Desfazer";
}

