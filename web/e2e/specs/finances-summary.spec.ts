import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, pt-BR first and then English: Resumo splits the Monthly income into spent, Bills still to pay and
// what is left, all as text, and over the income says so in ordinary ink with no alert. With no income it asks for one
// and leads to Ajustes. The pace sentence says "a mais" / "a menos" / "o mesmo" against the same days of last month,
// and the table view has the line's numbers. The next three unpaid Bills (overdue first) and the top three categories
// link to Contas and Gastos. Switching tabs adds no request. At 320px with the root font at 200% nothing overflows,
// in light and dark. The clock is fixed at 2030-01-15, so the previous month is December 2029.

const LOCALES = [
  {
    locale: "pt-BR",
    views: { spending: "Gastos", bills: "Contas" },
    heading: { split: "Sua renda neste mês", pace: "Ritmo dos gastos", bills: "Próximas contas", top: "Maiores gastos" },
    spent: /Gasto até agora: R\$\s*600,00/,
    unpaid: /Contas a pagar: R\$\s*2\.070,50/,
    left: /Sobra: R\$\s*829,50/,
    over: /R\$\s*670,50 além da renda/,
    none: "Informe sua renda mensal para ver como o mês está indo.",
    setIncome: "Informar renda mensal",
    changeIncome: "Alterar renda",
    more: /Até dia 15 você gastou R\$\s*300,00 a mais que até 15 de dezembro/,
    less: /Até dia 15 você gastou R\$\s*300,00 a menos que até 15 de dezembro/,
    same: /Até dia 15 você gastou o mesmo que até 15 de dezembro/,
    table: "Ver tabela",
    avgSentence1: /e R\$\s*300,00 a mais que a média de 1 mês/,
    avgSentence3: /e R\$\s*400,00 a mais que a média de 3 meses/,
    avgLabel1: "Média de 1 mês",
    avgLabel3: "Média de 3 meses",
    avgFinal3: /Média de 3 meses: R\$\s*366,67/,
    rough: /Menos de 3 meses de histórico/,
    noAverage: "Ainda sem histórico para a média.",
    overdue: /R\$\s*1\.500,00 · Venceu em 5 de jan/,
    dueLine: /R\$\s*210,50 · Vence 20 de jan/,
    emptyBills: "Nenhuma conta a pagar neste mês.",
    seeBills: "Ver contas",
    retry: "Tentar novamente",
    seeSpending: "Ver gastos",
    groceries: "Mercado",
    amounts: [/R\$\s*450,00/, /R\$\s*120,00/, /R\$\s*30,00/],
    dec: "dezembro",
    jan: "janeiro",
  },
  {
    locale: "en-US",
    views: { spending: "Spending", bills: "Bills" },
    heading: { split: "Your income this month", pace: "Spending pace", bills: "Next bills", top: "Top spending" },
    spent: /Spent so far: R\$\s*600\.00/,
    unpaid: /Bills still to pay: R\$\s*2,070\.50/,
    left: /Left: R\$\s*829\.50/,
    over: /R\$\s*670\.50 beyond your income/,
    none: "Set your monthly income to see how the month is going.",
    setIncome: "Set monthly income",
    changeIncome: "Change income",
    more: /Up to day 15 you spent R\$\s*300\.00 more than up to December 15/,
    less: /Up to day 15 you spent R\$\s*300\.00 less than up to December 15/,
    same: /Up to day 15 you spent the same as up to December 15/,
    table: "View table",
    avgSentence1: /and R\$\s*300\.00 more than your 1-month average/,
    avgSentence3: /and R\$\s*400\.00 more than your 3-month average/,
    avgLabel1: "1-month average",
    avgLabel3: "3-month average",
    avgFinal3: /3-month average: R\$\s*366\.67/,
    rough: /Less than 3 months of history/,
    noAverage: "No history yet for the average.",
    overdue: /R\$\s*1,500\.00 · Was due Jan 5/,
    dueLine: /R\$\s*210\.50 · Due Jan 20/,
    emptyBills: "No bills left to pay this month.",
    seeBills: "See bills",
    retry: "Try again",
    seeSpending: "See spending",
    groceries: "Groceries",
    amounts: [/R\$\s*450\.00/, /R\$\s*120\.00/, /R\$\s*30\.00/],
    dec: "December",
    jan: "January",
  },
] as const;

const tx = (id: string, postedOn: string, amountCents: number, spendingCategory: string) => ({
  id, postedOn, description: id, sourceName: "Pluggy Bank", amountCents, currency: "BRL", type: "expense" as const, spendingCategory,
});

/** January: 600,00 spent. December up to the 15th: `december` cents, and 500,00 more after the 15th that must not count. */
const connected = ({ income = 350000 as number | null, december = 30000, allPaid = false, older = false, noHistory = false } = {}) => {
  const s = signedInResident();
  s.user.finance = true;
  const paid: Record<string, "bank" | "hand"> = allPaid ? { "2030-01": "hand" } : {};
  s.finance = {
    configured: true,
    sources: [{ id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" }],
    importing: false,
    lastSyncedAt: "2030-01-15T12:00:00Z",
    monthlyIncomeCents: income,
    today: "2030-01-15",
    transactions: [
      tx("j1", "2030-01-02", -45000, "groceries"),
      tx("j2", "2030-01-05", -12000, "leisure"),
      tx("j3", "2030-01-10", -3000, "health"),
      ...(noHistory ? [] : [tx("d1", "2029-12-02", -december, "groceries"), tx("d2", "2029-12-20", -50000, "groceries")]),
      // November (200,00 by the 15th) and October (100,00) make the average three months.
      ...(older ? [tx("n1", "2029-11-03", -20000, "groceries"), tx("o1", "2029-10-04", -10000, "groceries")] : []),
    ],
    bills: [
      { id: "b1", name: "Aluguel", expectedCents: 150000, dueDay: 5, paid },
      { id: "b2", name: "Luz", expectedCents: 21050, dueDay: 20, paid },
      { id: "b3", name: "Condomínio", expectedCents: 30000, dueDay: 22, paid },
      { id: "b4", name: "Água", expectedCents: 6000, dueDay: 25, paid },
      { id: "b5", name: "Internet", expectedCents: 9990, dueDay: 10, paid: { "2030-01": "bank" as const } },
    ],
  };
  return s;
};

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: connected() });

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await page.clock.setFixedTime(new Date("2030-01-15T12:00:00-03:00"));
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
    });

    test("splits the income into spent, bills to pay and left, as text, and changing it leads to Ajustes", async ({ page }) => {
      await expect(page.getByText(l.spent)).toBeVisible();
      await expect(page.getByText(l.unpaid)).toBeVisible();
      await expect(page.getByText(l.left)).toBeVisible();
      await page.getByRole("link", { name: l.changeIncome }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/finances/ajustes");
    });

    test("says the pace in words against the same days of last month, and the table has the line's numbers", async ({ page }) => {
      await expect(page.getByText(l.more)).toBeVisible();
      const pace = page.getByRole("region", { name: l.heading.pace });
      await expect(pace.getByRole("img")).toHaveAccessibleName(new RegExp(`${l.dec}: R\\$\\s*800[.,]00`));
      await pace.getByRole("button", { name: l.table }).click();
      // Day 15: this month 600,00; the table runs over all 31 days of December.
      const day15 = pace.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "15", exact: true }) });
      await expect(day15.getByRole("cell").first()).toContainText(/600[.,]00/);
      await expect(pace.getByRole("row")).toHaveCount(32); // header + December's 31 days
    });

    test("lists the three nearest unpaid bills, overdue first, and the link opens Contas", async ({ page }) => {
      const next = page.getByRole("region", { name: l.heading.bills });
      const items = next.getByRole("listitem");
      await expect(items).toHaveCount(3);
      await expect(items.nth(0)).toContainText("Aluguel");
      await expect(items.nth(0)).toContainText(l.overdue);
      await expect(items.nth(1)).toContainText("Luz");
      await expect(items.nth(1)).toContainText(l.dueLine);
      await expect(items.nth(2)).toContainText("Condomínio");
      await expect(next).not.toContainText("Água");
      await next.getByRole("button", { name: l.seeBills }).click();
      await expect(page.getByRole("tab", { name: l.views.bills })).toHaveAttribute("aria-selected", "true");
    });

    test("shows the top three categories with amounts, and the link opens Gastos", async ({ page }) => {
      const top = page.getByRole("region", { name: l.heading.top });
      const items = top.getByRole("listitem");
      await expect(items).toHaveCount(3);
      await expect(items.nth(0)).toContainText(l.groceries);
      for (const [i, amount] of l.amounts.entries()) await expect(items.nth(i)).toContainText(amount);
      await top.getByRole("button", { name: l.seeSpending }).click();
      await expect(page.getByRole("tab", { name: l.views.spending })).toHaveAttribute("aria-selected", "true");
    });

    test("switching tabs adds no request", async ({ page, fakeApi }) => {
      await expect(page.getByText(l.left)).toBeVisible();
      await page.waitForLoadState("networkidle");
      const before = fakeApi.requests.length;
      for (const view of [l.views.spending, l.views.bills]) {
        await page.getByRole("tab", { name: view }).click();
        await expect(page.getByRole("tab", { name: view })).toHaveAttribute("aria-selected", "true");
      }
      await page.getByRole("tab", { name: /^(Resumo|Summary)$/ }).click();
      await expect(page.getByText(l.left)).toBeVisible();
      expect(fakeApi.requests.length).toBe(before);
    });

    for (const theme of ["light", "dark"] as const) {
      test(`holds at 320px and the largest text in the ${theme} theme`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.addInitScript((value) => {
          localStorage.setItem("homeowner.theme", value);
          document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
        }, theme);
        await visit(page, new URL("/finances", baseURL!).toString());
        await expect(page.getByText(l.left)).toBeVisible();
        await expect(page.getByRole("region", { name: l.heading.top }).getByRole("listitem")).toHaveCount(3);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      });
    }

    test.describe("when the bills cannot be read", () => {
      test("only the blocks that need them say so, each with Retry, and Retry brings the bills back", async ({ page, baseURL, fakeApi }) => {
        fakeApi.override("GET /me/finance/bills", { status: 500, body: { error: "boom" } }, { once: true });
        await visit(page, new URL("/finances", baseURL!).toString());
        const bills = page.getByRole("region", { name: l.heading.bills });
        const split = page.getByRole("region", { name: l.heading.split });
        for (const block of [bills, split]) {
          await expect(block.getByRole("alert")).toBeVisible();
          await expect(block.getByRole("button", { name: l.retry })).toBeVisible();
        }
        await expect(page.getByRole("region", { name: l.heading.pace }).getByText(l.more)).toBeVisible();
        await expect(page.getByRole("region", { name: l.heading.top }).getByRole("listitem")).toHaveCount(3);
        await bills.getByRole("button", { name: l.retry }).click();
        await expect(bills.getByRole("listitem")).toHaveCount(3);
        await expect(split.getByRole("alert")).toHaveCount(0);
        await expect(page.getByText(l.left)).toBeVisible();
      });
    });

    test.describe("over the income", () => {
      test.use({ fakeState: connected({ income: 200000 }) });

      test("says by how much in ordinary ink, with no alert", async ({ page }) => {
        const line = page.getByText(l.over);
        await expect(line).toBeVisible();
        await expect(page.getByText(l.left)).toHaveCount(0);
        await expect(page.getByRole("region", { name: l.heading.split }).getByRole("alert")).toHaveCount(0);
        const colours = await page.evaluate(() => {
          const color = (el: Element | null) => (el ? getComputedStyle(el).color : "");
          const items = [...document.querySelectorAll("li")];
          const over = items.find((li) => /(além da renda|beyond your income)/.test(li.textContent ?? ""));
          const spent = items.find((li) => /(Gasto até agora|Spent so far)/.test(li.textContent ?? ""));
          return [color(over ?? null), color(spent ?? null)];
        });
        expect(colours[0]).toBe(colours[1]);
      });
    });

    test.describe("with one month of history", () => {
      test("names the 1-month average in the sentence and the legend, and says the average is rough", async ({ page }) => {
        const pace = page.getByRole("region", { name: l.heading.pace });
        await expect(pace.getByText(l.avgSentence1)).toBeVisible();
        await expect(pace.getByText(l.avgLabel1, { exact: true })).toBeVisible();
        await expect(pace.getByText(l.rough)).toBeVisible();
      });

      test("still shows the sentence when the daily series cannot be read, and Retry brings the chart back", async ({ page, baseURL, fakeApi }) => {
        fakeApi.override("GET /me/finance/daily", { status: 500, body: { error: "boom" } }, { once: true });
        await visit(page, new URL("/finances", baseURL!).toString());
        const pace = page.getByRole("region", { name: l.heading.pace });
        await expect(pace.getByRole("alert")).toBeVisible();
        await expect(pace.getByText(l.more)).toBeVisible();
        await expect(pace.getByRole("img")).toHaveCount(0);
        await pace.getByRole("button", { name: l.retry }).click();
        await expect(pace.getByRole("img")).toBeVisible();
        await expect(pace.getByRole("alert")).toHaveCount(0);
      });
    });

    test.describe("with three months of history", () => {
      test.use({ fakeState: connected({ older: true }) });

      test("draws this month, last month and the 3-month average, each final amount as text, and the table has all three", async ({ page }) => {
        const pace = page.getByRole("region", { name: l.heading.pace });
        await expect(pace.getByText(l.avgSentence3)).toBeVisible();
        await expect(pace.getByText(l.avgLabel3, { exact: true })).toBeVisible();
        await expect(pace.getByText(l.rough)).toHaveCount(0);
        await expect(pace.getByRole("img")).toHaveAccessibleName(l.avgFinal3);
        await pace.getByRole("button", { name: l.table }).click();
        await expect(pace.getByRole("columnheader")).toHaveCount(4); // Day, January, December, average
        const day15 = pace.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "15", exact: true }) });
        await expect(day15.getByRole("cell").nth(2)).toContainText(/200[.,]00/);
      });
    });

    test.describe("with no history at all", () => {
      test.use({ fakeState: connected({ noHistory: true }) });

      test("says there is nothing to average and draws two lines", async ({ page }) => {
        const pace = page.getByRole("region", { name: l.heading.pace });
        await expect(pace.getByText(l.noAverage)).toBeVisible();
        await expect(pace.getByText(/Média de|-month average/)).toHaveCount(0);
      });
    });

    test.describe("with no income", () => {
      test.use({ fakeState: connected({ income: null }) });

      test("asks for it and leads to Ajustes instead of the bar", async ({ page }) => {
        await expect(page.getByText(l.none)).toBeVisible();
        await expect(page.getByText(l.spent)).toHaveCount(0);
        await page.getByRole("link", { name: l.setIncome }).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances/ajustes");
      });
    });

    test.describe("with every bill paid", () => {
      test.use({ fakeState: connected({ allPaid: true }) });

      test("shows a short neutral line in place of the bills", async ({ page }) => {
        await expect(page.getByText(l.emptyBills)).toBeVisible();
        await expect(page.getByRole("region", { name: l.heading.bills }).getByRole("listitem")).toHaveCount(0);
      });
    });

    test.describe("spending less than last month", () => {
      test.use({ fakeState: connected({ december: 90000 }) });

      test("reads a menos", async ({ page }) => {
        await expect(page.getByText(l.less)).toBeVisible();
      });
    });

    test.describe("spending the same as last month", () => {
      test.use({ fakeState: connected({ december: 60000 }) });

      test("reads o mesmo", async ({ page }) => {
        await expect(page.getByText(l.same)).toBeVisible();
      });
    });
  });
}
