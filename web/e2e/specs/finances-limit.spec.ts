import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";
import { financeView } from "../pages/finances";

// What this covers, pt-BR first, with the root font at 200%: a category with a limit shows a marker and its text
// ("limit R$ 800 · R$ 12 over the limit") in ordinary ink, with no icon; a category without one looks as before;
// the limit is set, changed and removed from the opened category with a status line; empty, zero, negative and
// junk input is explained and never sent; a failed write puts the old limit back and says so next to the field.

const LOCALES = [
  {
    locale: "pt-BR", groceries: "Mercado", leisure: "Lazer", save: "Salvar limite", remove: "Remover limite", label: "Limite mensal desta categoria",
    over: /limite R\$\s?800,00 · R\$\s?12,00 acima do limite/, under: /limite R\$\s?1\.000,00 · R\$\s?188,00 abaixo do limite/,
    saved: /Limite salvo: R\$\s?1\.000,00 por mês\./, removed: "Limite removido.", failed: /Não conseguimos salvar o limite/,
    empty: "Digite um valor, por exemplo 800,00.", zero: "O limite precisa ser maior que zero.", junk: "Use só números, por exemplo 800,00.",
    anyLimit: /limite R\$/, tab: "Gastos", typed: "1000,00",
  },
  {
    locale: "en-US", groceries: "Groceries", leisure: "Leisure", save: "Save limit", remove: "Remove limit", label: "Monthly limit for this category",
    over: /limit R\$\s?800\.00 · R\$\s?12\.00 over the limit/, under: /limit R\$\s?1,000\.00 · R\$\s?188\.00 under the limit/,
    saved: /Limit saved: R\$\s?1,000\.00 a month\./, removed: "Limit removed.", failed: /We could not save the limit/,
    empty: "Enter an amount, for example 800.00.", zero: "The limit must be more than zero.", junk: "Use numbers only, for example 800.00.",
    anyLimit: /limit R\$/, tab: "Spending", typed: "1000.00",
  },
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
    limits: { groceries: 80000 },
    transactions: [
      row("d1", "2026-12-05", "Mercado grande", -81200, "groceries"),
      row("d2", "2026-12-10", "Cinema", -12000, "leisure"),
      row("n1", "2026-11-05", "Mercado do mês passado", -69200, "groceries"),
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
      await financeView(page, l.tab).click();
    });

    // A category's button is its name, then the amount.
    const category = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name} R\\$`) });
    const bar = (page: Page, name: string) => page.locator("li").filter({ has: category(page, name) });
    const open = async (page: Page, name: string) => {
      const button = category(page, name);
      await button.click();
      return page.locator(`[id="${await button.getAttribute("aria-controls")}"]`);
    };
    const puts = (fakeApi: { requests: { method: string; path: string }[] }) =>
      fakeApi.requests.filter((r) => r.method === "PUT" && r.path.startsWith("/me/finance/budgets/"));

    test("shows the marker and neutral text only on the category with a limit", async ({ page }) => {
      const groceries = bar(page, l.groceries);
      await expect(groceries.getByText(l.over)).toBeVisible();
      await expect(groceries.locator("[data-limit-marker]")).toHaveCount(1);
      await expect(groceries.locator("[data-marker]")).toHaveCount(1); // last month's tick is still its own shape
      await expect(groceries.locator("svg")).toHaveCount(1); // the disclosure chevron only: no warning icon
      await expect(groceries.getByText(l.over)).not.toHaveClass(/danger/);

      const leisure = bar(page, l.leisure);
      await expect(leisure.locator("[data-limit-marker]")).toHaveCount(0);
      await expect(leisure.getByText(l.anyLimit)).toHaveCount(0);
    });

    test("changes the limit at once, confirms it, then removes it", async ({ page, fakeApi }) => {
      const body = await open(page, l.groceries);
      await body.getByLabel(l.label).fill(l.typed);
      await body.getByRole("button", { name: l.save }).click();
      await expect(body.getByRole("status")).toHaveText(l.saved);
      await expect(bar(page, l.groceries).getByText(l.under)).toBeVisible();
      expect(puts(fakeApi)).toHaveLength(1);
      expect(fakeApi.requests.find((r) => r.method === "PUT" && r.path.endsWith("/groceries"))?.body).toEqual({ limitCents: 100000 });

      await body.getByRole("button", { name: l.remove }).click();
      await expect(body.getByRole("status")).toHaveText(l.removed);
      await expect(bar(page, l.groceries).locator("[data-limit-marker]")).toHaveCount(0);
      await expect(bar(page, l.groceries).getByText(l.anyLimit)).toHaveCount(0);
      await expect(body.getByRole("button", { name: l.remove })).toHaveCount(0);
      await expect(body.getByLabel(l.label)).toBeFocused();
    });

    test("explains empty, zero, negative and junk input and sends nothing", async ({ page, fakeApi }) => {
      const body = await open(page, l.leisure);
      const field = body.getByLabel(l.label);
      for (const [text, message] of [["", l.empty], ["0", l.zero], ["-50", l.junk], ["abc", l.junk]] as const) {
        await field.fill(text);
        await body.getByRole("button", { name: l.save }).click();
        await expect(body.getByText(message)).toBeVisible();
        await expect(field).toHaveAttribute("aria-invalid", "true");
      }
      expect(puts(fakeApi)).toHaveLength(0);
    });

    test("a failed write puts the old limit back and says so beside the field", async ({ page }) => {
      let failing = true;
      await page.route(/\/me\/finance\/budgets\//, (route) => (failing ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : route.fallback()));
      const body = await open(page, l.groceries);
      await body.getByLabel(l.label).fill(l.typed);
      await body.getByRole("button", { name: l.save }).click();
      await expect(body.getByText(l.failed)).toBeVisible();
      await expect(bar(page, l.groceries).getByText(l.over)).toBeVisible();
      await expect(body.getByLabel(l.label)).not.toHaveValue(l.typed);
      failing = false;
      await body.getByLabel(l.label).fill(l.typed);
      await body.getByRole("button", { name: l.save }).click();
      await expect(body.getByRole("status")).toHaveText(l.saved);
    });
  });
}
