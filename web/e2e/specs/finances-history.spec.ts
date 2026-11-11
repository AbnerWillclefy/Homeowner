import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";
import { financeView } from "../pages/finances";

// What this covers, pt-BR first, with the clock fixed on 31 December, 320px wide and the root font at 200%: a
// category's own screen (reached by opening its card in Gastos and following "Ver histórico") shows six months of it,
// each amount as text, the viewed month marked in words; Gastos itself reads no history; a category with no spending
// in six months says so; a failed history read offers a retry while the limit form still works; the picked month
// travels there and back, and a deep link goes back to Gastos on its month; nothing overflows sideways.

const LOCALES = [
  { locale: "pt-BR", groceries: "Mercado", leisure: "Lazer", heading: "Últimos 6 meses", mark: "este mês", empty: "Sem gastos nesta categoria nos últimos 6 meses", failed: "Não conseguimos carregar o histórico.", retry: "Tentar novamente", year: "Julho de 2026", plain: "Novembro", prev: "Mês anterior", picked: "mês escolhido", january: "Janeiro de 2027", link: "Ver histórico", back: "Gastos", limit: "Limite mensal desta categoria", november: "Novembro de 2026", december: "Dezembro de 2026" },
  { locale: "en-US", groceries: "Groceries", leisure: "Leisure", heading: "Last 6 months", mark: "this month", empty: "No spending in this category in the last 6 months", failed: "We could not load the history.", retry: "Try again", year: "July 2026", plain: "November", prev: "Previous month", picked: "chosen month", january: "January 2027", link: "See history", back: "Spending", limit: "Monthly limit for this category", november: "November 2026", december: "December 2026" },
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
      row("f1", "2027-02-05", "Mercado de fevereiro", -10000, "groceries"),
    ],
  };
  return s;
};

/** A category's disclosure button: its name is the category, then the amount. */
const category = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name} R\\$`) });

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 320, height: 640 }, fakeState: connected() });

    /** Opens a category's card in Gastos and follows its link to the category screen. */
    const openHistory = async (page: Page, name: string) => {
      await category(page, name).click();
      await page.getByRole("link", { name: l.link }).click();
    };

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await page.clock.setFixedTime(new Date("2026-12-31T12:00:00-03:00"));
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
      });
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
      await financeView(page, /^(Gastos|Spending)$/).click();
    });

    test("shows six months with amounts as text and the viewed month marked; Gastos reads no history", async ({ page, fakeApi }) => {
      const reads = () => fakeApi.requests.filter((r) => r.method === "GET" && r.path === "/me/finance/history").length;
      await category(page, l.groceries).click();
      expect(reads()).toBe(0);
      await page.getByRole("link", { name: l.link }).click();
      await expect(page).toHaveURL(/\/finances\/gastos\/groceries$/);
      await expect(page.getByRole("heading", { name: l.groceries })).toBeVisible();
      await expect(page.getByText(l.heading)).toBeVisible();
      const main = page.getByRole("main");
      await expect(main).toContainText(l.year); // the first bar carries the year
      await expect(main).toContainText(l.plain); // the second month of the same year does not
      await expect(main).toContainText(/R\$\s?812[.,]00/);
      await expect(main).toContainText(/R\$\s?692[.,]00/);
      await expect(main).toContainText(/R\$\s?300[.,]00/);
      await expect(main.getByText(l.mark)).toHaveCount(1);
      expect(await main.locator("[data-fill]").count()).toBe(3);
      expect(await noOverflow(page)).toBe(true);
      expect(reads()).toBe(1);
    });

    test("keeps the picked month to the category screen and back, and marks it as chosen, not this month", async ({ page }) => {
      await page.getByRole("button", { name: l.prev, exact: true }).click();
      await openHistory(page, l.groceries);
      await expect(page).toHaveURL(/\/finances\/gastos\/groceries\?month=2026-11$/);
      await expect(page.getByText(l.november)).toBeVisible();
      await expect(page.getByText(l.picked)).toHaveCount(1);
      await expect(page.getByText(l.mark)).toHaveCount(0);
      await page.getByRole("button", { name: l.back, exact: true }).click();
      await expect(page).toHaveURL(/\/finances\/gastos\?month=2026-11$/);
      await expect(page.getByText(l.november)).toBeVisible();
    });

    test("a deep link opens the category and Back goes to Gastos on the same month", async ({ page, baseURL }) => {
      await visit(page, new URL("/finances/gastos/groceries?month=2026-11", baseURL!).toString());
      await expect(page.getByRole("heading", { name: l.groceries })).toBeVisible();
      await expect(page.getByText(l.picked)).toHaveCount(1);
      await page.getByRole("button", { name: l.back, exact: true }).click();
      await expect(page).toHaveURL(/\/finances\/gastos\?month=2026-11$/);
      await expect(category(page, l.groceries)).toBeVisible();
    });

    test("an unknown category goes to Today, never a blank screen", async ({ page, baseURL }) => {
      await visit(page, new URL("/finances/gastos/nope?month=2026-11", baseURL!).toString());
      await expect(page).toHaveURL(new URL("/", baseURL!).toString());
    });

    test("shows the year again where the six months cross into a new one", async ({ page, baseURL }) => {
      await page.clock.setFixedTime(new Date("2027-02-15T12:00:00-03:00"));
      await visit(page, new URL("/finances", baseURL!).toString());
      await financeView(page, /^(Gastos|Spending)$/).click();
      await openHistory(page, l.groceries);
      await expect(page.getByRole("main")).toContainText(l.january);
    });

    test("says so when the category had no spending in six months", async ({ page, baseURL }) => {
      await page.route(/\/me\/finance\/history/, (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ to: "2026-12", months: [{ month: "2026-12", spentCents: 0, categories: [] }] }) }),
      );
      await visit(page, new URL("/finances", baseURL!).toString());
      await financeView(page, /^(Gastos|Spending)$/).click();
      await openHistory(page, l.groceries);
      await expect(page.getByText(l.empty).first()).toBeVisible();
    });

    test("a failed history read retries on the category screen while the limit form still works", async ({ page, baseURL }) => {
      let failing = true;
      await page.route(/\/me\/finance\/history/, (route) => (failing ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : route.fallback()));
      await visit(page, new URL("/finances", baseURL!).toString());
      await financeView(page, /^(Gastos|Spending)$/).click();
      await openHistory(page, l.groceries);
      await expect(page.getByText(l.failed).first()).toBeVisible();
      await expect(page.getByLabel(l.limit)).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      failing = false;
      await page.getByRole("button", { name: l.retry }).first().click();
      await expect(page.getByText(l.heading).first()).toBeVisible();
    });
  });
}
