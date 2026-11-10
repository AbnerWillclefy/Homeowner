import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, pt-BR first and then English: in Ajustes de finanças a credit card Source says it has no bill days
// until they are typed; typing both saves them and the row shows them; one alone is refused with a message naming the
// missing one and nothing is sent; a checking Source has no days and no fields; Remover clears both; a failed save
// keeps what was typed and says so; the row and the form hold at 320px with a long card name.

const LOCALES = [
  {
    locale: "pt-BR",
    settings: "Ajustes de finanças",
    sources: "Fontes conectadas",
    unset: "Dias da fatura não informados",
    edit: "Editar dias da fatura de SANTANDER UNIQUE VISA INFINITE",
    close: "Fechamento",
    due: "Vencimento",
    save: "Salvar",
    clear: "Remover",
    row: "Fecha dia 7 · vence dia 12",
    needDue: "Informe também o dia de vencimento.",
    invalid: "Fechamento: digite um dia de 1 a 31.",
    failed: "Não conseguimos salvar. Tente de novo em instantes.",
  },
  {
    locale: "en-US",
    settings: "Finance settings",
    sources: "Connected Sources",
    unset: "Bill days not set",
    edit: "Edit bill days of SANTANDER UNIQUE VISA INFINITE",
    close: "Closing",
    due: "Due",
    save: "Save",
    clear: "Remove",
    row: "Closes on day 7 · due on day 12",
    needDue: "Enter the due day too.",
    invalid: "Closing: enter a day from 1 to 31.",
    failed: "We could not save. Try again in a moment.",
  },
] as const;

const configured = () => {
  const s = signedInResident();
  s.user.finance = true;
  s.finance = {
    configured: true,
    sources: [
      { id: "source-1", name: "Conta Pluggy", kind: "checking", currency: "BRL" },
      { id: "source-2", name: "SANTANDER UNIQUE VISA INFINITE", kind: "credit_card", currency: "BRL" },
    ],
    importing: false,
    lastSyncedAt: "2026-11-08T13:05:00Z",
  };
  return s;
};

const sourcesOf = (name: string) => (page: Page) => page.getByRole("region", { name });

for (const l of LOCALES) {
  const sources = sourcesOf(l.sources);
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: configured() });

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
      await page.getByRole("link", { name: l.settings }).click();
    });

    test("a card without days says so, and typing both saves them", async ({ page, fakeApi }) => {
      await expect(page.getByText(l.unset)).toHaveCount(1);
      await page.getByRole("button", { name: l.edit }).click();
      await expect(page.getByLabel(l.close)).toBeFocused();
      await page.getByLabel(l.close).fill("7");
      await page.getByLabel(l.due).fill("12");
      await sources(page).getByRole("button", { name: l.save }).click();
      await expect(page.getByText(l.row)).toBeVisible();
      await expect(page.getByLabel(l.close)).toHaveCount(0);
      await expect(page.getByRole("button", { name: l.edit })).toBeFocused();
      const put = fakeApi.requests.find((r) => r.method === "PUT" && r.path === "/me/finance/sources/source-2/bill-days");
      expect(put?.body).toEqual({ closeDay: 7, dueDay: 12 });
    });

    test("one day alone is refused before anything is sent, and so is a day out of range", async ({ page, fakeApi }) => {
      await page.getByRole("button", { name: l.edit }).click();
      await page.getByLabel(l.close).fill("7");
      await sources(page).getByRole("button", { name: l.save }).click();
      await expect(page.getByRole("alert").filter({ hasText: l.needDue })).toBeVisible();
      await expect(page.getByLabel(l.due)).toHaveAttribute("aria-invalid", "true");
      await page.getByLabel(l.close).fill("32");
      await page.getByLabel(l.due).fill("12");
      await sources(page).getByRole("button", { name: l.save }).click();
      await expect(page.getByRole("alert").filter({ hasText: l.invalid })).toBeVisible();
      expect(fakeApi.requests.filter((r) => r.method === "PUT" && r.path.endsWith("/bill-days"))).toEqual([]);
    });

    test("a checking Source has no days and no edit control", async ({ page }) => {
      await expect(page.getByText(l.unset)).toHaveCount(1);
      await expect(page.getByRole("button", { name: /Conta Pluggy/ })).toHaveCount(0);
    });

    test("Remover clears both days", async ({ page, fakeApi }) => {
      await page.getByRole("button", { name: l.edit }).click();
      await page.getByLabel(l.close).fill("7");
      await page.getByLabel(l.due).fill("12");
      await sources(page).getByRole("button", { name: l.save }).click();
      await expect(page.getByText(l.row)).toBeVisible();
      await page.getByRole("button", { name: l.edit }).click();
      await expect(page.getByLabel(l.close)).toHaveValue("7");
      await sources(page).getByRole("button", { name: l.clear }).click();
      await expect(page.getByText(l.unset)).toBeVisible();
      await expect(page.getByRole("button", { name: l.edit })).toBeFocused();
      const puts = fakeApi.requests.filter((r) => r.method === "PUT" && r.path.endsWith("/bill-days"));
      expect(puts.at(-1)?.body).toEqual({ closeDay: null, dueDay: null });
    });

    test("a failed save keeps the typed values and says so", async ({ page, fakeApi }) => {
      fakeApi.override("PUT /me/finance/sources/{id}/bill-days", { status: 500, body: { error: "boom" } });
      await page.getByRole("button", { name: l.edit }).click();
      await page.getByLabel(l.close).fill("7");
      await page.getByLabel(l.due).fill("12");
      await sources(page).getByRole("button", { name: l.save }).click();
      await expect(page.getByRole("alert").filter({ hasText: l.failed })).toBeVisible();
      await expect(page.getByLabel(l.close)).toHaveValue("7");
      await expect(page.getByLabel(l.due)).toHaveValue("12");
    });

    test("at 320px and the largest text nothing overflows sideways", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await page.getByRole("button", { name: l.edit }).click();
      await expect(page.getByLabel(l.close)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
}
