import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, in both locales: the Finances tab shows this month's spending by Spending Category in BRL, opens a
// category to its Transactions (a refund says so in words), lists Transfers apart as left out of the totals, edits a
// Transaction's type and category with the totals read again, and says calmly when a month is empty. At 320px with
// the root font at 200% nothing overflows sideways.

const LOCALES = [
  {
    locale: "pt-BR",
    total: /R\$\s*550,90/,
    afterTransfer: /R\$\s*430,90/,
    groceries: "Mercado",
    leisure: "Lazer",
    pets: "Pets",
    refund: "estorno",
    transfers: "Transferências",
    leftOut: "Fora dos totais",
    empty: "Nada por aqui neste mês.",
    prev: "Mês anterior",
    next: "Próximo mês",
    transfer: "Transferência",
    expense: "Despesa",
    category: "Categoria de gasto",
    save: "Salvar",
    gone: "Esse lançamento não está mais aqui. Lemos o mês de novo.",
  },
  {
    locale: "en-US",
    total: /R\$550\.90/,
    afterTransfer: /R\$430\.90/,
    groceries: "Groceries",
    leisure: "Leisure",
    pets: "Pets",
    refund: "refund",
    transfers: "Transfers",
    leftOut: "Left out of totals",
    empty: "Nothing here this month.",
    prev: "Previous month",
    next: "Next month",
    transfer: "Transfer",
    expense: "Expense",
    category: "Spending category",
    save: "Save",
    gone: "That transaction is no longer there. We read the month again.",
  },
] as const;

const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const row = (id: string, day: string, description: string, amountCents: number, type: "income" | "expense" | "transfer", spendingCategory: string | null) => ({
  id, postedOn: `${thisMonth}-${day}`, description, sourceName: "Pluggy Bank", amountCents, currency: "BRL", type, spendingCategory,
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
      row("t1", "02", "Supermercado Pão de Açúcar Paulista filial centro", -45090, "expense", "groceries"),
      row("t2", "03", "Devolução Supermercado", 5000, "expense", "groceries"),
      row("t3", "04", "Cinema", -12000, "expense", "leisure"),
      row("t4", "05", "Transferência para poupança", -100000, "transfer", null),
      row("t5", "06", "Salário", 300000, "income", null),
      row("t6", "07", "Farmácia", -3000, "expense", "health"),
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
      await page.getByRole("tab", { name: /^(Gastos|Spending)$/ }).click(); // Finances opens on Resumo
    });

    test("shows the total, the categories, a refund in words and the transfers apart", async ({ page }) => {
      await expect(page.getByText(l.total).first()).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(l.groceries) })).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(l.leisure) })).toBeVisible();

      const groceries = page.getByRole("button", { name: new RegExp(l.groceries) });
      await expect(groceries).toHaveAttribute("aria-expanded", "false");
      await groceries.click();
      await expect(groceries).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByText("Supermercado Pão de Açúcar Paulista filial centro")).toBeVisible();
      await expect(page.getByText(l.refund)).toBeVisible();

      const group = page.getByRole("region", { name: l.transfers });
      await expect(group.getByText(l.leftOut)).toBeVisible();
      await expect(group.getByText("Transferência para poupança")).toBeVisible();
    });

    test("editing a transaction to a Transfer takes it out of the totals", async ({ page, fakeApi }) => {
      await page.getByRole("button", { name: new RegExp(l.leisure) }).click();
      await page.getByRole("button", { name: /Cinema/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("radio", { name: l.transfer }).check({ force: true });
      await expect(dialog.getByLabel(l.category)).toHaveCount(0);
      await dialog.getByRole("button", { name: l.save }).click();

      await expect(dialog).toHaveCount(0);
      expect(fakeApi.requests.find((r) => r.method === "PATCH")?.body).toEqual({ type: "transfer" });
      await expect(page.getByText(l.afterTransfer).first()).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(l.leisure) })).toHaveCount(0);
      await expect(page.getByRole("region", { name: l.transfers }).getByText("Cinema")).toBeVisible();
    });

    test("changing the category files the expense under the new one", async ({ page, fakeApi }) => {
      await page.getByRole("button", { name: new RegExp(l.leisure) }).click();
      await page.getByRole("button", { name: /Cinema/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(l.category).selectOption("pets");
      await dialog.getByRole("button", { name: l.save }).click();

      await expect(dialog).toHaveCount(0);
      expect(fakeApi.requests.find((r) => r.method === "PATCH")?.body).toEqual({ spendingCategory: "pets" });
      await expect(page.getByRole("button", { name: new RegExp(l.pets) })).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(l.leisure) })).toHaveCount(0);
      await expect(page.getByText(l.total).first()).toBeVisible();
    });

    test("a transaction that is gone reads the month again", async ({ page, fakeApi }) => {
      await page.getByRole("button", { name: new RegExp(l.leisure) }).click();
      await page.getByRole("button", { name: /Cinema/ }).click();
      fakeApi.state.finance!.transactions = fakeApi.state.finance!.transactions!.filter((t) => t.id !== "t3");
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("radio", { name: l.transfer }).check({ force: true });
      await dialog.getByRole("button", { name: l.save }).click();

      await expect(dialog).toHaveCount(0);
      await expect(page.getByText(l.gone)).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(l.leisure) })).toHaveCount(0);

      await page.getByRole("button", { name: l.prev, exact: true }).click();
      await expect(page.getByText(l.gone)).toHaveCount(0);
    });

    test("an empty month is a calm line, and the next month is not offered past this one", async ({ page }) => {
      await expect(page.getByRole("button", { name: l.next, exact: true })).toBeDisabled();
      await page.getByRole("button", { name: l.prev, exact: true }).click();
      await expect(page.getByText(l.empty)).toBeVisible();
      await expect(page.getByRole("button", { name: l.next, exact: true })).toBeEnabled();
      await page.getByRole("button", { name: l.next, exact: true }).click();
      await expect(page.getByText(l.total).first()).toBeVisible();
    });

    test("at 320px and the largest text nothing overflows sideways", async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
      });
      await visit(page, new URL("/finances", baseURL!).toString());
      await page.getByRole("tab", { name: /^(Gastos|Spending)$/ }).click(); // Finances opens on Resumo
      await page.getByRole("button", { name: new RegExp(l.groceries) }).click();
      await expect(page.getByText(l.refund)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
}
