import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, in both locales: the Report section compares this month's spending by Spending Category with the
// month before, every category as a list item whose text carries both values, a sentence that says the difference
// neutrally, a month change that asks for the new month and updates the sentence, and a calm empty month. At 320px
// with the root font at 200% nothing overflows sideways and the longest category names wrap.

const LOCALES = [
  {
    locale: "pt-BR",
    heading: "Relatório",
    groceries: "Mercado",
    household: "Contas da casa",
    taxes: "Impostos e taxas",
    more: (month: string) => new RegExp(`R\\$\\s*240,00 a mais que em ${month}`),
    thisValue: (month: string) => new RegExp(`${month}: R\\$\\s*812,00`),
    previousValue: (month: string) => new RegExp(`${month}: R\\$\\s*692,00`),
    zero: /R\$\s*0,00/,
    empty: /Sem gastos em/,
    prev: "Mês anterior do relatório",
  },
  {
    locale: "en-US",
    heading: "Report",
    groceries: "Groceries",
    household: "Household bills",
    taxes: "Taxes and fees",
    more: (month: string) => new RegExp(`R\\$240\\.00 more than in ${month}`),
    thisValue: (month: string) => new RegExp(`${month}: R\\$812\\.00`),
    previousValue: (month: string) => new RegExp(`${month}: R\\$692\\.00`),
    zero: /R\$0\.00/,
    empty: /No spending in/,
    prev: "Previous report month",
  },
] as const;

const month = (back: number) => {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() - back, 1);
  return { id: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, d };
};
const nameOf = (back: number, locale: string) => new Intl.DateTimeFormat(locale, { month: "long" }).format(month(back).d);

const row = (id: string, back: number, description: string, amountCents: number, spendingCategory: string) => ({
  id, postedOn: `${month(back).id}-05`, description, sourceName: "Pluggy Bank", amountCents, currency: "BRL", type: "expense" as const, spendingCategory,
});

const connected = () => {
  const s = signedInResident();
  s.user.finance = true;
  s.finance = {
    configured: true,
    sources: [{ id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" }],
    importing: false,
    lastSyncedAt: "2026-11-08T13:05:00Z",
    transactions: [
      row("a", 0, "Mercado grande", -81200, "groceries"),
      row("b", 0, "Cinema", -12000, "leisure"),
      row("c", 1, "Mercado do mês passado", -69200, "groceries"),
    ],
  };
  return s;
};

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: connected() });

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
    });

    test("lists every category with both months in text, and says the difference", async ({ page }) => {
      const report = page.getByRole("region", { name: l.heading });
      await expect(report.getByText(l.more(nameOf(1, l.locale)))).toBeVisible();
      await expect(report.getByRole("listitem")).toHaveCount(13);
      const groceries = report.getByRole("listitem").filter({ hasText: l.groceries });
      await expect(groceries).toContainText(l.thisValue(nameOf(0, l.locale)));
      await expect(groceries).toContainText(l.previousValue(nameOf(1, l.locale)));
      // A category with no spending is still there, with its zero in text.
      await expect(report.getByRole("listitem").filter({ hasText: l.taxes })).toContainText(l.zero);
      await expect(report.getByRole("listitem").filter({ hasText: l.household })).toBeVisible();
    });

    test("changing the month asks for it and updates the sentence", async ({ page }) => {
      const report = page.getByRole("region", { name: l.heading });
      const asked = page.waitForRequest((r) => r.url().includes("/me/finance/report") && r.url().includes(`month=${month(1).id}`));
      await report.getByRole("button", { name: l.prev }).click();
      await asked;
      await expect(report.getByRole("listitem").filter({ hasText: l.groceries })).toContainText(l.previousValue(nameOf(1, l.locale)));
      await expect(report.getByText(nameOf(2, l.locale), { exact: false }).first()).toBeVisible();
    });

    test("an empty month is a calm line with no bars", async ({ page }) => {
      const report = page.getByRole("region", { name: l.heading });
      await report.getByRole("button", { name: l.prev }).click();
      await report.getByRole("button", { name: l.prev }).click();
      await expect(report.getByText(l.empty)).toBeVisible();
      await expect(report.getByRole("listitem")).toHaveCount(0);
    });

    test("at 320px and the largest text nothing overflows sideways", async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
      });
      await visit(page, new URL("/finances", baseURL!).toString());
      const report = page.getByRole("region", { name: l.heading });
      await expect(report.getByText(l.taxes)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
}
