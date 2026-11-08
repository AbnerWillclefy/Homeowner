import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, in both locales, with the clock fixed on 31 December (the previous month has 30 days): Gastos
// says in neutral words how the month compares with the same days of November (cut at day 30), lists the Transactions
// with no Spending Category in a card that edits them and disappears once none are left, draws every category as a bar
// with last month's same-days value as text, opens a category by day, keeps Transfers and income under "Fora dos
// totais", compares a past month whole, and says so when the month before has no data. Editing reads every month
// again. At 320px with the root font at 200% nothing overflows sideways.

const LOCALES = [
  {
    locale: "pt-BR",
    more: /R\$\s*125,10 a mais que em novembro até dia 30/,
    wholeNone: "Sem lançamentos em outubro para comparar.",
    groceries: "Mercado",
    leisure: "Lazer",
    other: "Outros",
    health: "Saúde",
    pets: "Pets",
    marker: /novembro até dia 30: R\$\s*792,00/,
    healthMarker: /novembro até dia 30: R\$\s*89,90/,
    uncategorised: "Sem categoria de gasto",
    count: /1 lançamento precisa de uma categoria/,
    leftOut: "Fora dos totais",
    transfers: "Transferências",
    income: "Receitas",
    prev: "Mês anterior",
    category: "Categoria de gasto",
    save: "Salvar",
  },
  {
    locale: "en-US",
    more: /R\$125\.10 more than in November up to day 30/,
    wholeNone: "No transactions in October to compare with.",
    groceries: "Groceries",
    leisure: "Leisure",
    other: "Other",
    health: "Health",
    pets: "Pets",
    marker: /November up to day 30: R\$792\.00/,
    healthMarker: /November up to day 30: R\$89\.90/,
    uncategorised: "No spending category",
    count: /1 transaction needs a category/,
    leftOut: "Left out of totals",
    transfers: "Transfers",
    income: "Income",
    prev: "Previous month",
    category: "Spending category",
    save: "Save",
  },
] as const;

const row = (
  id: string,
  postedOn: string,
  description: string,
  amountCents: number,
  type: "income" | "expense" | "transfer",
  spendingCategory: string | null,
  categorySetBy: "auto" | "fallback" | null = spendingCategory ? "auto" : null,
) => ({ id, postedOn, description, sourceName: "Pluggy Bank", amountCents, currency: "BRL", type, spendingCategory, categorySetBy });

const connected = () => {
  const s = signedInResident();
  s.user.finance = true;
  s.finance = {
    configured: true,
    sources: [{ id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" }],
    importing: false,
    lastSyncedAt: "2026-12-31T13:05:00Z",
    transactions: [
      row("d1", "2026-12-05", "Mercado grande", -81200, "expense", "groceries"),
      row("d2", "2026-12-20", "Padaria", -3000, "expense", "groceries"),
      row("d3", "2026-12-10", "Cinema", -12000, "expense", "leisure"),
      row("d4", "2026-12-12", "Compra sem nome", -4500, "expense", "other", "fallback"),
      row("d5", "2026-12-15", "Transferência para poupança", -100000, "transfer", null),
      row("d6", "2026-12-16", "Salário", 300000, "income", null),
      row("n1", "2026-11-05", "Mercado do mês passado", -69200, "expense", "groceries"),
      row("n2", "2026-11-30", "Mercado de fim de mês", -10000, "expense", "groceries"),
      row("n3", "2026-11-20", "Farmácia", -8990, "expense", "health"),
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
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
      await page.getByRole("tab", { name: /^(Gastos|Spending)$/ }).click(); // Finances opens on Resumo
    });

    test("compares with the same days of the 30-day month before, in neutral words, with every amount as text", async ({ page }) => {
      await expect(page.getByText(l.more)).toBeVisible();
      const groceries = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: l.groceries }) });
      await expect(groceries).toContainText(/R\$\s?842[.,]00/);
      await expect(groceries).toContainText(l.marker);
      // A category spent only last month is a zero bar with its marker.
      const health = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: l.health }) });
      await expect(health).toContainText(/R\$\s?0[.,]00/);
      await expect(health).toContainText(l.healthMarker);
      // Biggest first.
      const names = await page.locator("li button[aria-expanded]").allInnerTexts();
      expect(names.map((n) => n.trim())).toEqual([l.groceries, l.leisure, l.other, l.health]);
    });

    test("opens a category by day, newest first", async ({ page }) => {
      const button = page.getByRole("button", { name: l.groceries, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-expanded", "true");
      const body = page.locator(`#${await button.getAttribute("aria-controls")}`);
      await expect(body.getByRole("heading")).toHaveCount(2);
      await expect(body.getByRole("button").first()).toContainText("Padaria");
      await expect(body.getByRole("button").last()).toContainText("Mercado grande");
    });

    test("the no-category card counts, edits and goes away, and every month is read again", async ({ page }) => {
      const card = page.getByRole("region", { name: l.uncategorised });
      await expect(card).toContainText(l.count);
      let novemberReads = 0;
      page.on("request", (r) => void (r.url().includes("/me/finance/transactions?month=2026-11") && r.method() === "GET" && novemberReads++));
      const before = novemberReads;

      await card.getByRole("button", { name: /Compra sem nome/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(l.category).selectOption("pets");
      await dialog.getByRole("button", { name: l.save }).click();

      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("region", { name: l.uncategorised })).toHaveCount(0);
      await expect(page.getByRole("button", { name: l.pets })).toBeVisible();
      await expect.poll(() => novemberReads).toBeGreaterThan(before);
    });

    test("keeps Transfers and income apart, outside every total", async ({ page }) => {
      const leftOut = page.getByRole("region", { name: l.leftOut });
      await expect(leftOut.getByRole("group", { name: l.transfers })).toContainText("Transferência para poupança");
      await expect(leftOut.getByRole("group", { name: l.income })).toContainText("Salário");
      await expect(page.getByText(l.more)).toBeVisible(); // 100700 would differ had they counted
    });

    test("a past month is compared whole, and says when the month before has no data", async ({ page }) => {
      await page.getByRole("button", { name: l.prev, exact: true }).click();
      await expect(page.getByText(l.wholeNone)).toBeVisible();
      await expect(page.getByRole("button", { name: l.groceries })).toBeVisible();
    });

    test("at 320px and the largest text nothing overflows sideways", async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
      });
      await visit(page, new URL("/finances", baseURL!).toString());
      await page.getByRole("tab", { name: /^(Gastos|Spending)$/ }).click();
      await page.getByRole("button", { name: l.groceries }).click();
      await expect(page.getByText(l.marker)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
}
