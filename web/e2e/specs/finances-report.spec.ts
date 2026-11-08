import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, in both locales: the Spending view compares the month with the one before as text. The total
// says the difference neutrally, each category card says what it was last month, a category spent on only last month
// is listed apart, and a category at zero in both months is not listed at all. A month change asks for that month's
// report. At 320px with the root font at 200% nothing overflows sideways.

const LOCALES = [
  {
    locale: "pt-BR",
    groceries: "Mercado",
    health: "Saúde",
    taxes: "Impostos e taxas",
    more: (month: string) => new RegExp(`R\\$\\s*150,10 a mais que em ${month}`),
    previousValue: (month: string) => new RegExp(`${month}: R\\$\\s*692,00`),
    onlyLast: (month: string) => `Só em ${month}`,
    prev: "Mês anterior",
  },
  {
    locale: "en-US",
    groceries: "Groceries",
    health: "Health",
    taxes: "Taxes and fees",
    more: (month: string) => new RegExp(`R\\$150\\.10 more than in ${month}`),
    previousValue: (month: string) => new RegExp(`${month}: R\\$692\\.00`),
    onlyLast: (month: string) => `Only in ${month}`,
    prev: "Previous month",
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
      row("d", 1, "Farmácia", -8990, "health"),
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

    test("says the difference, last month per category, and leaves out categories at zero", async ({ page }) => {
      const last = nameOf(1, l.locale);
      await expect(page.getByText(l.more(last))).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(l.groceries) })).toContainText(l.previousValue(last));
      const only = page.getByRole("region", { name: l.onlyLast(last) });
      await expect(only).toContainText(l.health);
      await expect(page.getByText(l.taxes)).toHaveCount(0);
    });

    test("changing the month asks for that month's report", async ({ page }) => {
      const asked = page.waitForRequest((r) => r.url().includes("/me/finance/report") && r.url().includes(`month=${month(1).id}`));
      await page.getByRole("button", { name: l.prev, exact: true }).click();
      await asked;
      await expect(page.getByRole("button", { name: new RegExp(l.groceries) })).toContainText(nameOf(2, l.locale));
    });

    test("at 320px and the largest text nothing overflows sideways", async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
      });
      await visit(page, new URL("/finances", baseURL!).toString());
      await expect(page.getByRole("region", { name: l.onlyLast(nameOf(1, l.locale)) })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
}
