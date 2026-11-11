import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";
import { financeView } from "../pages/finances";

// What this covers, pt-BR first and then English, with the clock fixed on 15 November 2026: "Próximos meses" (in the
// Contas view) draws one folding card per month, the current one open. Each card says Total and, with a Monthly
// income, the leftover, closed or open. The open November card lists every group and line the API gives (card bills,
// other bills with "paga", planned spending, what was already spent off the card) and the income last; a card without
// its closing day says so; December opens to its own lines and has no "already spent". Without an income there is no
// leftover and the screen offers to set it; a total above the income says so in neutral words, with no danger colour,
// alarm icon or exclamation mark. The plans in progress keep their next part, total and last month. A failed read
// says so with Retry. At 320px with the root font at 200% nothing overflows sideways.

const LOCALES = [
  {
    locale: "pt-BR",
    heading: "Próximos meses",
    bills: "Contas",
    settings: "Ajustes de finanças",
    back: "Finanças",
    income: "Quanto entra por mês",
    save: "Salvar",
    clear: "Limpar",
    november: /novembro de 2026/i,
    december: /dezembro de 2026/i,
    january: /janeiro de 2027/i,
    thisMonth: "este mês",
    total: "Total",
    leftover: "Sobra",
    monthlyIncome: "Renda mensal",
    groups: {
      cards: "Faturas dos cartões",
      bills: "Outras contas",
      planned: "Gasto previsto (o que falta dos limites)",
      plannedLater: "Gasto previsto",
      spent: "Já gasto fora do cartão",
    },
    paid: "Aluguel · paga",
    installments: "Parcelamentos fora do cartão",
    groceries: "Mercado",
    noDays: "Sem dia de fechamento: conta pela data da compra.",
    noCard: "Nenhuma fatura conhecida ainda.",
    over: "O total passa a renda em R$ 1.000,00.",
    noIncome: "Informe sua renda mensal para ver a sobra de cada mês.",
    setIncome: "Informar renda mensal",
    footnote:
      /Nos meses seguintes, a fatura conta só as parcelas já conhecidas/,
    plansHeading: "Parcelas em andamento",
    plans: [
      ["Sofá", "próxima 3 de 3 · última em Novembro"],
      ["Geladeira", "próxima 4 de 10 · última em Junho"],
      ["Televisão", "próxima 2 de 6 · última em Abril"],
    ],
    failed:
      "Não conseguimos carregar os próximos meses. Verifique sua conexão e tente de novo.",
    retry: "Tentar novamente",
    problems: {
      empty: "Digite sua renda mensal, por exemplo 5.000,00.",
      zero: "A renda mensal precisa ser maior que zero.",
      junk: "Use só números, por exemplo 5.000,00.",
    },
    typed: "8.000,00",
  },
  {
    locale: "en-US",
    heading: "Coming months",
    bills: "Bills",
    settings: "Finance settings",
    back: "Finances",
    income: "How much comes in each month",
    save: "Save",
    clear: "Clear",
    november: /November 2026/i,
    december: /December 2026/i,
    january: /January 2027/i,
    thisMonth: "this month",
    total: "Total",
    leftover: "Leftover",
    monthlyIncome: "Monthly income",
    groups: {
      cards: "Card bills",
      bills: "Other bills",
      planned: "Planned spending (left of your limits)",
      plannedLater: "Planned spending",
      spent: "Already spent off the card",
    },
    paid: "Aluguel · paid",
    installments: "Installments off the card",
    groceries: "Groceries",
    noDays: "No closing day from the bank: counted by purchase date.",
    noCard: "No card bill known yet.",
    over: "The total is R$1,000.00 above your income.",
    noIncome: "Set your monthly income to see what is left each month.",
    setIncome: "Set monthly income",
    footnote:
      /In later months a card bill counts only the installments already known/,
    plansHeading: "Installments in progress",
    plans: [
      ["Sofá", "next 3 of 3 · last in November"],
      ["Geladeira", "next 4 of 10 · last in June"],
      ["Televisão", "next 2 of 6 · last in April"],
    ],
    failed:
      "We could not load the coming months. Check your connection and try again.",
    retry: "Try again",
    problems: {
      empty: "Enter your monthly income, for example 5,000.00.",
      zero: "Monthly income must be more than zero.",
      junk: "Use numbers only, for example 5,000.00.",
    },
    typed: "8,000.00",
  },
] as const;

const INTER = {
  sourceId: "card-2",
  name: "Inter Mastercard Platinum",
  amountCents: 50000,
  billDaysKnown: false,
};
const NUBANK = {
  sourceId: "card-1",
  name: "Nubank",
  amountCents: 100000,
  billDaysKnown: true,
};

const connected = (options: { income?: number } = {}) => {
  const { income } = options;
  const s = signedInResident();
  s.user.finance = true;
  s.finance = {
    configured: true,
    sources: [
      {
        id: "source-1",
        name: "Pluggy Bank",
        kind: "checking",
        currency: "BRL",
      },
    ],
    importing: false,
    lastSyncedAt: "2026-11-08T13:05:00Z",
    ...(income ? { monthlyIncomeCents: income } : {}),
    commitments: [
      {
        month: "2026-11",
        installments: [
          { name: "Sofá", number: 3, total: 3, amountCents: 20000 },
        ],
        cards: [NUBANK, INTER],
        otherBills: [
          { id: "bill-1", name: "Aluguel", cents: 200000, paid: true },
          { id: "bill-2", name: "Luz", cents: 15000, paid: false },
        ],
        otherInstallmentsCents: 30000,
        planned: [{ category: "groceries", cents: 80000 }],
        plannedCents: 80000,
        spentOffCardCents: 25000,
        totalCents: 500000,
      },
      {
        month: "2026-12",
        installments: [
          { name: "Geladeira", number: 4, total: 10, amountCents: 45000 },
          { name: "Televisão", number: 2, total: 6, amountCents: 30000 },
        ],
        cards: [NUBANK, INTER],
        otherBills: [
          { id: "bill-1", name: "Aluguel", cents: 200000, paid: false },
        ],
        otherInstallmentsCents: 0,
        planned: [{ category: "groceries", cents: 80000 }],
        plannedCents: 80000,
        totalCents: 430000,
      },
      {
        month: "2027-01",
        installments: [
          { name: "Geladeira", number: 5, total: 10, amountCents: 45000 },
        ],
        cards: [],
        otherBills: [],
        otherInstallmentsCents: 0,
        planned: [],
        plannedCents: 0,
        totalCents: 0,
      },
    ],
  };
  return s;
};

/** `R$ 1.234,56` as the locale writes it, with a plain space so a text match does not depend on the no-break one. */
const brl = (locale: string, cents: number) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" })
    .format(cents / 100)
    .replace(/\s/g, " ");

const section = (page: Page, heading: string) =>
  page.getByRole("region", { name: heading, exact: true });
/** The income form alone: Ajustes has other forms with their own alerts. */
const income = (page: Page) =>
  page
    .locator("form")
    .filter({
      has: page.getByLabel(
        /^(Quanto entra por mês|How much comes in each month)$/,
      ),
    });

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 } });
    const money = (cents: number) => brl(l.locale, cents);

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await page.clock.setFixedTime(new Date("2026-11-15T12:00:00-03:00"));
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
    });

    const settings = async (page: Page) => {
      await page.getByRole("link", { name: l.settings, exact: true }).click();
      return page.locator("main");
    };
    const comingMonths = async (page: Page) => {
      if (page.url().includes("/finances/ajustes"))
        await page.getByRole("button", { name: l.back, exact: true }).click();
      await financeView(page, l.bills).click();
      return section(page, l.heading);
    };
    const monthCard = (page: Page, name: RegExp) =>
      page.getByRole("region", { name });

    test.describe("with an income", () => {
      test.use({ fakeState: connected({ income: 800000 }) });

      test("opens the current month with every group and line, and shows each month's total and leftover closed", async ({
        page,
      }) => {
        await comingMonths(page);
        const nov = monthCard(page, l.november);
        await expect(nov).toContainText(l.thisMonth);
        await expect(nov.getByRole("button", { expanded: true })).toBeVisible();
        await expect(nov).toContainText(`${l.total} ${money(500000)}`);
        await expect(nov).toContainText(`${l.leftover} ${money(300000)}`);
        for (const text of [
          `${l.groups.cards} ${money(150000)}`,
          `Nubank ${money(100000)}`,
          `Inter Mastercard Platinum ${money(50000)}`,
          `${l.groups.bills} ${money(245000)}`,
          `${l.paid} ${money(200000)}`,
          `Luz ${money(15000)}`,
          `${l.installments} ${money(30000)}`,
          `${l.groups.planned} ${money(80000)}`,
          `${l.groceries} ${money(80000)}`,
          `${l.groups.spent} ${money(25000)}`,
          `${l.monthlyIncome} ${money(800000)}`,
        ])
          await expect(nov).toContainText(text);
        await expect(nov.getByText(l.over)).toHaveCount(0);

        const dec = monthCard(page, l.december);
        await expect(
          dec.getByRole("button", { expanded: false }),
        ).toBeVisible();
        await expect(dec).toContainText(`${l.total} ${money(430000)}`);
        await expect(dec).toContainText(`${l.leftover} ${money(370000)}`);
        await expect(dec.getByText(l.groups.spent)).toBeHidden();
        await dec.getByRole("button").click();
        await expect(
          dec.getByText(l.groups.plannedLater, { exact: true }),
        ).toBeVisible();
        await expect(dec.getByText(l.groups.spent)).toHaveCount(0);
        await expect(dec.getByText("Aluguel", { exact: true })).toBeVisible();
      });

      test("says in one line under the card which one has no closing day, and what a month with no card bill says", async ({
        page,
      }) => {
        await comingMonths(page);
        const nov = monthCard(page, l.november);
        await expect(nov.getByText(l.noDays)).toHaveCount(1);
        // `last()` is the card's own line, inside the group's line.
        await expect(
          nov
            .getByRole("listitem")
            .filter({ hasText: "Inter Mastercard Platinum" })
            .last(),
        ).toContainText(l.noDays);
        await expect(
          nov.getByRole("listitem").filter({ hasText: "Nubank" }).last(),
        ).not.toContainText(l.noDays);
        const jan = monthCard(page, l.january);
        await jan.getByRole("button").click();
        await expect(jan.getByText(l.noCard)).toBeVisible();
      });

      test("lists the plans in progress with the next part, the total and the last month, and the footnote", async ({
        page,
      }) => {
        const s = await comingMonths(page);
        const plans = s.getByRole("region", { name: l.plansHeading });
        await expect(plans).toBeVisible();
        for (const [name, text] of l.plans)
          await expect(
            plans.getByRole("listitem").filter({ hasText: name }),
          ).toContainText(text);
        // A plan that appears in two months is listed once.
        await expect(plans.getByText(/Geladeira/)).toHaveCount(1);
        await expect(s.getByText(l.footnote)).toBeVisible();
      });

      test("clearing the income in Ajustes takes the leftover away", async ({
        page,
      }) => {
        await settings(page);
        await income(page).getByRole("button", { name: l.clear }).click();
        await expect(page.getByLabel(l.income)).toHaveValue("");
        const s = await comingMonths(page);
        await expect(s.getByText(l.noIncome)).toBeVisible();
        await expect(monthCard(page, l.november)).not.toContainText(l.leftover);
      });
    });

    test.describe("with a total above the income", () => {
      test.use({ fakeState: connected({ income: 400000 }) });

      test("shows a negative leftover and says by how much in neutral words, with no alarm", async ({
        page,
      }) => {
        const s = await comingMonths(page);
        const nov = monthCard(page, l.november);
        await expect(nov).toContainText(`${l.leftover} ${money(-100000)}`);
        await expect(nov.getByText(l.over)).toBeVisible();
        expect(await s.innerText()).not.toContain("!");
        await expect(
          s.locator(
            "svg.lucide-triangle-alert, svg.lucide-circle-alert, [class*='danger']",
          ),
        ).toHaveCount(0);
      });
    });

    test.describe("without an income", () => {
      test.use({ fakeState: connected() });

      test("has no leftover and offers to set the income; setting it in Ajustes brings the leftover", async ({
        page,
      }) => {
        const s = await comingMonths(page);
        await expect(s.getByText(l.noIncome)).toBeVisible();
        await expect(s.getByRole("link", { name: l.setIncome })).toBeVisible();
        const nov = monthCard(page, l.november);
        await expect(nov).toContainText(`${l.total} ${money(500000)}`);
        await expect(nov).not.toContainText(l.leftover);
        await expect(nov).not.toContainText(l.monthlyIncome);

        await s.getByRole("link", { name: l.setIncome }).click();
        await expect(page).toHaveURL(/\/finances\/ajustes/);
        await page.getByLabel(l.income).fill(l.typed);
        await income(page).getByRole("button", { name: l.save }).click();
        await expect(page.getByLabel(l.income)).toHaveValue(l.typed);
        await expect(income(page).getByRole("alert")).toBeEmpty();
        await comingMonths(page);
        await expect(monthCard(page, l.november)).toContainText(
          `${l.leftover} ${money(300000)}`,
        );
      });

      test("an income that is empty, zero or not a number is explained and not sent", async ({
        page,
        fakeApi,
      }) => {
        await settings(page);
        const form = income(page);
        const save = form.getByRole("button", { name: l.save });
        await save.click();
        await expect(form.getByRole("alert")).toHaveText(l.problems.empty);
        await page.getByLabel(l.income).fill("0");
        await save.click();
        await expect(form.getByRole("alert")).toHaveText(l.problems.zero);
        await page.getByLabel(l.income).fill("abc");
        await save.click();
        await expect(form.getByRole("alert")).toHaveText(l.problems.junk);
        expect(
          fakeApi.requests.filter((r) => r.path === "/me/finance/income"),
        ).toEqual([]);
      });
    });

    test.describe("when the commitments cannot be read", () => {
      test.use({ fakeState: connected() });

      test("the coming months say so with Retry, and so does Ajustes where the income was", async ({
        page,
        fakeApi,
      }) => {
        fakeApi.override("GET /me/finance/commitments", {
          status: 500,
          body: { error: "boom" },
        });
        await page.reload();
        const s = await comingMonths(page);
        await expect(
          s.getByRole("alert").filter({ hasText: l.failed }),
        ).toBeVisible();
        await expect(s.getByRole("button", { name: l.retry })).toBeVisible();
        const main = await settings(page);
        await expect(
          main.getByRole("alert").filter({ hasText: l.failed }),
        ).toBeVisible();
        await expect(main.getByRole("button", { name: l.retry })).toBeVisible();
      });
    });

    test.describe("at 320px and the largest text", () => {
      test.use({
        fakeState: connected({ income: 400000 }),
        viewport: { width: 320, height: 640 },
      });

      test("nothing overflows sideways, even with the long card name and the open months", async ({
        page,
      }) => {
        await page.addInitScript(() => {
          document.addEventListener(
            "DOMContentLoaded",
            () => (document.documentElement.style.fontSize = "200%"),
          );
        });
        await page.reload();
        const s = await comingMonths(page);
        await monthCard(page, l.december).getByRole("button").click();
        await monthCard(page, l.january).getByRole("button").click();
        await expect(
          monthCard(page, l.november).getByText("Inter Mastercard Platinum"),
        ).toBeVisible();
        await expect(s.getByText(l.plans[0][1])).toBeVisible();
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
      });
    });
  });
}
