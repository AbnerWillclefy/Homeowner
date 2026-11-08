import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, pt-BR first, with the clock fixed on 31 December and the root font at 200%: opening a category
// shows six months of it, each amount as text, the viewed month marked in words; opening a second category reads
// nothing again; a category with no spending in six months says so; a failed history read offers a retry while the
// Transactions still list.

const LOCALES = [
  { locale: "pt-BR", groceries: "Mercado", leisure: "Lazer", heading: "Últimos 6 meses", mark: "este mês", empty: "Sem gastos nesta categoria nos últimos 6 meses", failed: "Não conseguimos carregar o histórico.", retry: "Tentar novamente", year: "julho de 2026", plain: "novembro" },
  { locale: "en-US", groceries: "Groceries", leisure: "Leisure", heading: "Last 6 months", mark: "this month", empty: "No spending in this category in the last 6 months", failed: "We could not load the history.", retry: "Try again", year: "July 2026", plain: "November" },
] as const;

const row = (id: string, postedOn: string, description: string, amountCents: number, spendingCategory: string) => ({
  id, postedOn, description, sourceName: "Pluggy Bank", amountCents, currency: "BRL", type: "expense" as const, spendingCategory, categorySetBy: "auto" as const,
});

const connected = () => {
  const s = signedInResident();
  s.user.finance = true;
  s.finance = {
    configured: true,
    sources: [{ id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" }],
    importing: false,
    lastSyncedAt: "2026-12-31T13:05:00Z",
    transactions: [
      row("d1", "2026-12-05", "Mercado grande", -81200, "groceries"),
      row("d2", "2026-12-10", "Cinema", -12000, "leisure"),
      row("n1", "2026-11-05", "Mercado do mês passado", -69200, "groceries"),
      row("a1", "2026-08-05", "Mercado de agosto", -30000, "groceries"),
    ],
  };
  return s;
};

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: connected() });

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await page.clock.setFixedTime(new Date("2026-12-31T12:00:00-03:00"));
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
      });
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
      await page.getByRole("tab", { name: /^(Gastos|Spending)$/ }).click();
    });

    test("shows six months with amounts as text, the viewed month marked, and reads once for every category", async ({ page, fakeApi }) => {
      const reads = () => fakeApi.requests.filter((r) => r.method === "GET" && r.path === "/me/finance/history").length;
      const groceries = page.getByRole("button", { name: l.groceries, exact: true });
      await groceries.click();
      const body = page.locator(`#${await groceries.getAttribute("aria-controls")}`);
      await expect(body.getByText(l.heading)).toBeVisible();
      await expect(body).toContainText(l.year); // the first bar carries the year
      await expect(body).toContainText(l.plain); // the second month of the same year does not
      await expect(body).toContainText(/R\$\s?812[.,]00/);
      await expect(body).toContainText(/R\$\s?692[.,]00/);
      await expect(body).toContainText(/R\$\s?300[.,]00/);
      await expect(body.getByText(l.mark)).toHaveCount(1);
      expect(await body.locator("[data-fill]").count()).toBe(3);

      const leisure = page.getByRole("button", { name: l.leisure, exact: true });
      await leisure.click();
      await expect(page.locator(`#${await leisure.getAttribute("aria-controls")}`).getByText(l.heading)).toBeVisible();
      expect(reads()).toBe(1);
    });

    test("says so when the category had no spending in six months", async ({ page, baseURL }) => {
      await page.route(/\/me\/finance\/history/, (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ to: "2026-12", months: [{ month: "2026-12", spentCents: 0, categories: [] }] }) }),
      );
      await visit(page, new URL("/finances", baseURL!).toString());
      await page.getByRole("tab", { name: /^(Gastos|Spending)$/ }).click();
      await page.getByRole("button", { name: l.groceries, exact: true }).click();
      await expect(page.getByText(l.empty).first()).toBeVisible();
    });

    test("a failed history read retries inside the category while the Transactions still list", async ({ page, baseURL }) => {
      let failing = true;
      await page.route(/\/me\/finance\/history/, (route) => (failing ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : route.fallback()));
      await visit(page, new URL("/finances", baseURL!).toString());
      await page.getByRole("tab", { name: /^(Gastos|Spending)$/ }).click();
      await page.getByRole("button", { name: l.groceries, exact: true }).click();
      await expect(page.getByText(l.failed).first()).toBeVisible();
      await expect(page.getByText("Mercado grande")).toBeVisible();
      failing = false;
      await page.getByRole("button", { name: l.retry }).first().click();
      await expect(page.getByText(l.heading).first()).toBeVisible();
    });
  });
}
