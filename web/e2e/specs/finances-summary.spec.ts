import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";
import { financeView } from "../pages/finances";

// What this covers, pt-BR first and then English: Resumo shows the current month's leftover, the first month of
// "Próximos meses" read from the same single request, with the four group totals as text; over the income it says so
// in ordinary ink with no alert, and with nothing committed the leftover is the income. With no income it asks for one,
// leads to Ajustes and keeps the four rows and the Total. A failed commitments read hides only that card. A past month
// has no card. The pace sentence says "a mais" / "a menos" / "o mesmo" against the same days of last month,
// and the table view has the line's numbers. The next three unpaid Bills (overdue first) and the top three categories
// link to Contas and Gastos. Switching tabs adds no request. At 320px with the root font at 200% nothing overflows,
// in light and dark. The clock is fixed at 2030-01-15, so the previous month is December 2029.

const LOCALES = [
  {
    locale: "pt-BR",
    views: { spending: "Gastos", bills: "Contas" },
    heading: { split: "A sobra de janeiro", pace: "Gasto ao longo do mês", bills: "Próximas contas", top: "Onde mais gastou" },
    left: /R\$\s*1\.000,00/,
    leftSentence: /Depois das faturas, das contas e do gasto previsto, sobram R\$\s*1\.000,00 da renda\./,
    overSentence: /passam a renda em R\$\s*500,00\./,
    negative: /[-−]\s?R\$\s*500,00/,
    zeroSentence: /sobram R\$\s*3\.500,00 da renda\./,
    totals: [/Total\s*R\$\s*2\.500,00/, /Renda mensal\s*R\$\s*3\.500,00/],
    groups: [
      /Faturas dos cartões\s*R\$\s*1\.100,00/,
      /Outras contas\s*R\$\s*700,00/,
      /Gasto previsto \(o que falta dos limites\)\s*R\$\s*500,00/,
      /Já gasto fora do cartão\s*R\$\s*200,00/,
    ],
    none: "Informe sua renda mensal para ver a sobra do mês.",
    seeMonths: "Ver próximos meses",
    commitHeading: "Próximos meses",
    setIncome: "Informar renda mensal",
    changeIncome: "Alterar renda",
    more: /Até dia 15 você gastou R\$\s*300,00 a mais que até 15 de dezembro/,
    less: /Até dia 15 você gastou R\$\s*300,00 a menos que até 15 de dezembro/,
    same: /Até dia 15 você gastou o mesmo que até 15 de dezembro/,
    table: "Ver dia a dia em tabela",
    avgSentence1: /e R\$\s*300,00 a mais que a média de 1 mês/,
    avgSentence3: /e R\$\s*400,00 a mais que a média de 3 meses/,
    avgLabel1: "Média de 1 mês",
    avgLabel3: "Média de 3 meses",
    avgFinal3: /Média de 3 meses: R\$\s*366,67/,
    rough: /Menos de 3 meses de histórico/,
    noAverage: "Ainda sem histórico para a média.",
    overdue: /Venceu em 5 de jan.*R\$\s*1\.500,00/,
    dueLine: /Vence 20 de jan.*R\$\s*210,50/,
    emptyBills: "Nenhuma conta a pagar neste mês.",
    seeBills: "Ver as 5 contas do mês",
    retry: "Tentar novamente",
    seeSpending: "Ver todos os gastos",
    groceries: "Mercado",
    amounts: [/R\$\s*450,00/, /R\$\s*120,00/, /R\$\s*30,00/],
    dec: "dezembro",
    jan: "janeiro",
  },
  {
    locale: "en-US",
    views: { spending: "Spending", bills: "Bills" },
    heading: { split: "Your January leftover", pace: "Spending through the month", bills: "Next bills", top: "Where you spent most" },
    left: /R\$\s*1,000\.00/,
    leftSentence: /After card bills, other bills and planned spending, R\$\s*1,000\.00 of your income is left\./,
    overSentence: /are R\$\s*500\.00 above your income\./,
    negative: /[-−]\s?R\$\s*500\.00/,
    zeroSentence: /R\$\s*3,500\.00 of your income is left\./,
    totals: [/Total\s*R\$\s*2,500\.00/, /Monthly income\s*R\$\s*3,500\.00/],
    groups: [
      /Card bills\s*R\$\s*1,100\.00/,
      /Other bills\s*R\$\s*700\.00/,
      /Planned spending \(left of your limits\)\s*R\$\s*500\.00/,
      /Already spent off the card\s*R\$\s*200\.00/,
    ],
    none: "Set your monthly income to see what is left this month.",
    seeMonths: "See coming months",
    commitHeading: "Coming months",
    setIncome: "Set monthly income",
    changeIncome: "Change income",
    more: /Up to day 15 you spent R\$\s*300\.00 more than up to December 15/,
    less: /Up to day 15 you spent R\$\s*300\.00 less than up to December 15/,
    same: /Up to day 15 you spent the same as up to December 15/,
    table: "See day by day as a table",
    avgSentence1: /and R\$\s*300\.00 more than your 1-month average/,
    avgSentence3: /and R\$\s*400\.00 more than your 3-month average/,
    avgLabel1: "1-month average",
    avgLabel3: "3-month average",
    avgFinal3: /3-month average: R\$\s*366\.67/,
    rough: /Less than 3 months of history/,
    noAverage: "No history yet for the average.",
    overdue: /Was due Jan 5.*R\$\s*1,500\.00/,
    dueLine: /Due Jan 20.*R\$\s*210\.50/,
    emptyBills: "No bills left to pay this month.",
    seeBills: "See this month's 5 bills",
    retry: "Try again",
    seeSpending: "See all spending",
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
const connected = ({ income = 350000 as number | null, december = 30000, allPaid = false, older = false, noHistory = false, total = 250000 } = {}) => {
  const s = signedInResident();
  s.user.finance = true;
  const paid: Record<string, "bank" | "hand"> = allPaid ? { "2030-01": "hand" } : {};
  s.finance = {
    configured: true,
    sources: [{ id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" }],
    importing: false,
    lastSyncedAt: "2030-01-15T12:00:00Z",
    monthlyIncomeCents: income,
    // January: cards 1.100,00 + other bills 700,00 + planned 500,00 + spent off the card 200,00 = 2.500,00; the fake derives the leftover.
    commitments: [
      total === 0
        ? { month: "2030-01", installments: [], cards: [], otherBills: [], otherInstallmentsCents: 0, planned: [], plannedCents: 0, spentOffCardCents: 0, totalCents: 0 }
        : {
            month: "2030-01",
            installments: [],
            cards: [{ sourceId: "card-1", name: "Nubank", amountCents: 110000, billDaysKnown: true }],
            otherBills: [{ id: "b1", name: "Aluguel", cents: 70000, paid: false }],
            otherInstallmentsCents: 0,
            planned: [{ category: "groceries", cents: 50000 }],
            plannedCents: 50000,
            spentOffCardCents: 20000,
            totalCents: total,
          },
    ],
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

    test("shows the current month's leftover from the first of the coming months, with the four groups, and the links lead on", async ({ page }) => {
      const card = page.getByRole("region", { name: l.heading.split });
      await expect(card).toContainText(l.left);
      await expect(card).toContainText(l.leftSentence);
      for (const row of [...l.totals, ...l.groups]) await expect(card).toContainText(row);
      // The same number the first month of "Próximos meses" shows.
      await card.getByRole("link", { name: l.seeMonths }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/finances/contas");
      await expect(page.getByRole("region", { name: /janeiro de 2030|January 2030/i })).toContainText(l.left);
      await page.goBack();
      await page.getByRole("link", { name: l.changeIncome }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/finances/ajustes");
    });

    test("opening Resumo reads the commitments once", async ({ page, fakeApi }) => {
      await expect(page.getByRole("region", { name: l.heading.split })).toContainText(l.left);
      await page.waitForLoadState("networkidle");
      expect(fakeApi.requests.filter((r) => r.path.startsWith("/me/finance/commitments")).length).toBe(1);
    });

    test("hides the leftover card on a past month", async ({ page, baseURL }) => {
      await visit(page, new URL("/finances?month=2029-12", baseURL!).toString());
      await expect(page.getByRole("region", { name: l.heading.pace })).toBeVisible();
      await expect(page.getByRole("link", { name: l.seeMonths })).toHaveCount(0);
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
      await next.getByRole("link", { name: l.seeBills }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/finances/contas");
      await expect(financeView(page, l.views.bills)).toHaveAttribute("aria-current", "page");
    });

    test("shows the top three categories with amounts, and the link opens Gastos", async ({ page }) => {
      const top = page.getByRole("region", { name: l.heading.top });
      const items = top.getByRole("listitem");
      await expect(items).toHaveCount(3);
      await expect(items.nth(0)).toContainText(l.groceries);
      for (const [i, amount] of l.amounts.entries()) await expect(items.nth(i)).toContainText(amount);
      await top.getByRole("link", { name: l.seeSpending }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/finances/gastos");
      await expect(financeView(page, l.views.spending)).toHaveAttribute("aria-current", "page");
    });

    test("going to another view and back reads the month only once", async ({ page, fakeApi }) => {
      await expect(page.getByRole("region", { name: l.heading.split })).toContainText(l.left);
      await page.waitForLoadState("networkidle");
      const reads = () => fakeApi.requests.filter((r) => r.path === "/me/finance/transactions?month=2030-01").length;
      const before = reads();
      await financeView(page, l.views.bills).click();
      await expect(financeView(page, l.views.bills)).toHaveAttribute("aria-current", "page");
      await financeView(page, /^(Resumo|Summary)$/).click();
      await expect(page.getByRole("region", { name: l.heading.split })).toContainText(l.left);
      expect(reads()).toBe(before);
    });

    for (const theme of ["light", "dark"] as const) {
      test(`holds at 320px and the largest text in the ${theme} theme`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.addInitScript((value) => {
          localStorage.setItem("homeowner.theme", value);
          document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
        }, theme);
        await visit(page, new URL("/finances", baseURL!).toString());
        await expect(page.getByRole("region", { name: l.heading.split })).toContainText(l.left);
        await expect(page.getByRole("region", { name: l.heading.top }).getByRole("listitem")).toHaveCount(3);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      });
    }

    test.describe("when the bills cannot be read", () => {
      test("only the Bills block says so, with Retry, and the leftover stays", async ({ page, baseURL, fakeApi }) => {
        fakeApi.override("GET /me/finance/bills", { status: 500, body: { error: "boom" } }, { once: true });
        await visit(page, new URL("/finances", baseURL!).toString());
        const bills = page.getByRole("region", { name: l.heading.bills });
        const card = page.getByRole("region", { name: l.heading.split });
        await expect(bills.getByRole("alert")).toBeVisible();
        await expect(bills.getByRole("button", { name: l.retry })).toBeVisible();
        await expect(card).toContainText(l.left);
        await expect(card.getByRole("alert")).toHaveCount(0);
        await expect(page.getByRole("region", { name: l.heading.pace }).getByText(l.more)).toBeVisible();
        await expect(page.getByRole("region", { name: l.heading.top }).getByRole("listitem")).toHaveCount(3);
        await bills.getByRole("button", { name: l.retry }).click();
        await expect(bills.getByRole("listitem")).toHaveCount(3);
      });
    });

    test.describe("over the income", () => {
      test.use({ fakeState: connected({ income: 200000 }) });

      test("states the negative leftover in neutral words: no alert, no danger colour", async ({ page }) => {
        const card = page.getByRole("region", { name: l.heading.split });
        await expect(card).toContainText(l.negative);
        await expect(card).toContainText(l.overSentence);
        await expect(card.getByRole("alert")).toHaveCount(0);
        await expect(card.locator("svg")).toHaveCount(0); // no alarm icon
        const colour = (target: typeof card) => target.evaluate((el) => getComputedStyle(el).color);
        // The negative stat has the same ink as an ordinary amount in the card.
        expect(await colour(card.locator("p", { hasText: l.negative }).first())).toBe(await colour(card.locator("dd").first()));
      });
    });

    test.describe("with one month of history", () => {
      test("names the 1-month average in the sentence and the legend, and says the average is rough", async ({ page }) => {
        const pace = page.getByRole("region", { name: l.heading.pace });
        await expect(pace.getByText(l.avgSentence1)).toBeVisible();
        await expect(pace.getByRole("listitem").filter({ hasText: l.avgLabel1 })).toHaveCount(1);
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
        await expect(pace.getByRole("listitem").filter({ hasText: l.avgLabel3 })).toHaveCount(1);
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

      test("asks for it and leads to Ajustes, with the four groups and the Total but no leftover", async ({ page }) => {
        const card = page.getByRole("region", { name: l.heading.split });
        await expect(card.getByText(l.none)).toBeVisible();
        await expect(card).not.toContainText(l.left);
        await expect(card).not.toContainText(l.totals[1]);
        for (const row of [l.totals[0], ...l.groups]) await expect(card).toContainText(row);
        await card.getByRole("link", { name: l.setIncome }).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances/ajustes");
      });
    });

    test.describe("with an income and nothing committed", () => {
      test.use({ fakeState: connected({ total: 0 }) });

      test("the leftover is the whole income", async ({ page }) => {
        const card = page.getByRole("region", { name: l.heading.split });
        await expect(card).toContainText(l.zeroSentence);
        await expect(card.getByText(l.none)).toHaveCount(0);
      });
    });

    test.describe("when the commitments cannot be read", () => {
      test("only the leftover card says so, with Retry, and Retry brings it back", async ({ page, baseURL, fakeApi }) => {
        fakeApi.override("GET /me/finance/commitments", { status: 500, body: { error: "boom" } }, { once: true });
        await visit(page, new URL("/finances", baseURL!).toString());
        const card = page.getByRole("region", { name: l.heading.split });
        await expect(card.getByRole("alert")).toBeVisible();
        await expect(page.getByRole("region", { name: l.heading.bills }).getByRole("listitem")).toHaveCount(3);
        await expect(page.getByRole("region", { name: l.heading.pace }).getByText(l.more)).toBeVisible();
        await expect(page.getByRole("region", { name: l.heading.top }).getByRole("listitem")).toHaveCount(3);
        await card.getByRole("button", { name: l.retry }).click();
        await expect(card).toContainText(l.left);
        await expect(card.getByRole("alert")).toHaveCount(0);
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
