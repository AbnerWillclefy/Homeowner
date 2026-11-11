import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";
import { financeView } from "../pages/finances";

// What this covers, pt-BR first and then English, with the clock fixed on 15 November 2026: in Ajustes de finanças a
// Source can be given a name, and the new name shows at once in Ajustes (the bank's name stays as secondary text), in
// Gastos (a Transaction's source) and in Contas (the card bill list of Próximos meses), because every Finances read
// is fetched again, a screen already visited included.
// "Use the bank's name" sends null and goes back; an empty name is refused before anything is sent; the field cuts
// a longer paste at 60 characters, and a server too_long still shows its message. At 320px with the root font at 200%
// the long bank name wraps and nothing overflows sideways.

const LOCALES = [
  {
    locale: "pt-BR",
    settings: "Ajustes de finanças",
    sources: "Fontes conectadas",
    back: "Finanças",
    spending: /^Gastos$/,
    bills: /^Contas$/,
    groceries: /Mercado/,
    rename: (name: string) => `Renomear ${name}`,
    label: "Nome",
    save: "Salvar",
    cancel: "Cancelar",
    useBank: "Usar nome do banco",
    bank: (name: string) => `Banco: ${name}`,
    required: "Digite um nome.",
    tooLong: "Use até 60 caracteres.",
  },
  {
    locale: "en-US",
    settings: "Finance settings",
    sources: "Connected Sources",
    back: "Finances",
    spending: /^Spending$/,
    bills: /^Bills$/,
    groceries: /Groceries/,
    rename: (name: string) => `Rename ${name}`,
    label: "Name",
    save: "Save",
    cancel: "Cancel",
    useBank: "Use the bank's name",
    bank: (name: string) => `Bank: ${name}`,
    required: "Enter a name.",
    tooLong: "Use up to 60 characters.",
  },
] as const;

const LONG = "Nu Pagamentos S.A. - Instituição de Pagamento";
const CARD = "Cartão Nu";

const connected = () => {
  const s = signedInResident();
  s.user.finance = true;
  s.finance = {
    configured: true,
    sources: [
      { id: "source-1", name: LONG, kind: "checking", currency: "BRL" },
      { id: "source-2", name: CARD, kind: "credit_card", currency: "BRL" },
    ],
    importing: false,
    lastSyncedAt: "2026-11-08T13:05:00Z",
    transactions: [
      { id: "t1", postedOn: "2026-11-02", description: "Supermercado", sourceName: LONG, amountCents: -45090, currency: "BRL", type: "expense", spendingCategory: "groceries" },
    ],
    commitments: [
      {
        month: "2026-11",
        installments: [],
        cards: [{ sourceId: "source-2", name: CARD, amountCents: 100000, billDaysKnown: true }],
        otherBills: [],
        otherInstallmentsCents: 0,
        planned: [],
        plannedCents: 0,
        totalCents: 100000,
      },
    ],
  };
  return s;
};

/** Leaves Ajustes through its back button, then opens one Finances view. */
const goTo = async (page: Page, back: string, view: RegExp) => {
  await page.getByRole("button", { name: back, exact: true }).click();
  await financeView(page, view).click();
};

const sourcesOf =(page: Page, name: string) => page.getByRole("region", { name });

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: connected() });

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await page.clock.setFixedTime(new Date("2026-11-15T12:00:00-03:00"));
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
      await page.getByRole("link", { name: l.settings, exact: true }).click();
    });

    test("a new name shows in Ajustes, Gastos and Contas, and the bank's name stays beside it", async ({ page, fakeApi }) => {
      const sources = sourcesOf(page, l.sources);
      await expect(sources.getByText(LONG)).toBeVisible();
      await expect(sources.getByText(l.bank(LONG))).toHaveCount(0);

      await sources.getByRole("button", { name: l.rename(LONG) }).click();
      await expect(page.getByLabel(l.label, { exact: true })).toBeFocused();
      await page.getByLabel(l.label, { exact: true }).fill("  Nubank  ");
      await sources.getByRole("button", { name: l.save }).click();

      await expect(page.getByLabel(l.label, { exact: true })).toHaveCount(0);
      await expect(sources.getByText("Nubank", { exact: true })).toBeVisible();
      await expect(sources.getByText(l.bank(LONG))).toBeVisible();
      await expect(sources.getByRole("button", { name: l.rename("Nubank") })).toBeFocused();
      expect(fakeApi.requests.find((r) => r.method === "PUT" && r.path === "/me/finance/sources/source-1/name")?.body).toEqual({ name: "Nubank" });

      await goTo(page, l.back, l.spending);
      await page.getByRole("button", { name: l.groceries }).click();
      await expect(page.getByText("Nubank", { exact: false }).first()).toBeVisible();
      await expect(page.getByText(LONG)).toHaveCount(0);
    });

    test("a card's new name reaches the card bills in Contas", async ({ page }) => {
      const sources = sourcesOf(page, l.sources);
      await sources.getByRole("button", { name: l.rename(CARD) }).click();
      await page.getByLabel(l.label, { exact: true }).fill("Cartão roxo");
      await sources.getByRole("button", { name: l.save }).click();
      await expect(sources.getByText("Cartão roxo", { exact: true })).toBeVisible();

      await goTo(page, l.back, l.bills);
      await expect(page.getByText("Cartão roxo").first()).toBeVisible();
      await expect(page.getByText(CARD)).toHaveCount(0);
    });

    test("the bank's name button sends null and shows only while a name is set", async ({ page, fakeApi }) => {
      const sources = sourcesOf(page, l.sources);
      await sources.getByRole("button", { name: l.rename(LONG) }).click();
      await expect(sources.getByRole("button", { name: l.useBank })).toHaveCount(0);
      await page.getByLabel(l.label, { exact: true }).fill("Nubank");
      await sources.getByRole("button", { name: l.save }).click();
      await sources.getByRole("button", { name: l.rename("Nubank") }).click();
      await sources.getByRole("button", { name: l.useBank }).click();

      await expect(sources.getByText(LONG, { exact: true })).toBeVisible();
      await expect(sources.getByText(l.bank(LONG))).toHaveCount(0);
      await expect(sources.getByRole("button", { name: l.rename(LONG) })).toBeFocused();
      const puts = fakeApi.requests.filter((r) => r.method === "PUT" && r.path.endsWith("/name"));
      expect(puts.at(-1)?.body).toEqual({ name: null });
    });

    test("an empty name is refused before anything is sent", async ({ page, fakeApi }) => {
      const sources = sourcesOf(page, l.sources);
      await sources.getByRole("button", { name: l.rename(LONG) }).click();
      await page.getByLabel(l.label, { exact: true }).fill("   ");
      await sources.getByRole("button", { name: l.save }).click();
      await expect(page.getByRole("alert").filter({ hasText: l.required })).toBeVisible();
      await expect(page.getByLabel(l.label, { exact: true })).toHaveAttribute("aria-invalid", "true");
      expect(fakeApi.requests.filter((r) => r.method === "PUT" && r.path.endsWith("/name"))).toEqual([]);
    });

    test("the field cuts a paste at 60 characters, and a server too_long still shows its message", async ({ page, fakeApi }) => {
      const sources = sourcesOf(page, l.sources);
      await sources.getByRole("button", { name: l.rename(LONG) }).click();
      await page.getByLabel(l.label, { exact: true }).fill("a".repeat(61));
      await expect(page.getByLabel(l.label, { exact: true })).toHaveValue("a".repeat(60));

      fakeApi.override("PUT /me/finance/sources/{id}/name", { status: 400, body: { error: "invalid source name", fields: { name: "too_long" } } });
      await sources.getByRole("button", { name: l.save }).click();
      await expect(page.getByRole("alert").filter({ hasText: l.tooLong })).toBeVisible();
      await expect(page.getByLabel(l.label, { exact: true })).toHaveValue("a".repeat(60));
    });

    test("at 320px and the largest text the long bank name wraps and nothing overflows sideways", async ({ page }) => {
      const sources = sourcesOf(page, l.sources);
      await sources.getByRole("button", { name: l.rename(LONG) }).click();
      await page.getByLabel(l.label, { exact: true }).fill("Nubank");
      await sources.getByRole("button", { name: l.save }).click();
      await sources.getByRole("button", { name: l.rename("Nubank") }).click();
      await page.setViewportSize({ width: 320, height: 640 });
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await expect(page.getByLabel(l.label, { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
}
