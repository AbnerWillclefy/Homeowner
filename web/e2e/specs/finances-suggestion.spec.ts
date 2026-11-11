import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import type { FakeState } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, pt-BR first and then English: the month's suggestion card in Resumo, right under the leftover
// card. It leads with the Monthly contribution, lists the reserve and each Goal in order with this month's amount and
// the expected month, and links to Economias. Leftover above the contribution: the extra and how many months sooner
// (a plural), no button. Below it: the shortfall and the Categories over their limit in plain text, or that none is.
// No income, no Monthly contribution, no reserve target and money with no Goal each say what is missing and link to
// where it is set. A late Goal, a Goal not reached in 10 years and a full Goal each say so instead of a date. A failed
// read hides only this card and Retry brings it back. Economias shows each progress with its amounts and the month.
// No element in the card uses the danger colour. At 320px with the root font at 200% nothing overflows sideways.
// The clock is fixed at 2030-01-15.

const LOCALES = [
  {
    locale: "pt-BR",
    heading: "Para guardar em Janeiro",
    leftover: "A sobra de Janeiro",
    contribution: "Aporte mensal",
    reserve: "Reserva de emergência",
    seeSavings: "Ver economias",
    seeSpending: "Ver gastos",
    setIncome: "Informar renda mensal",
    setContribution: "Definir aporte",
    setTarget: "Definir meta",
    addGoal: "Criar objetivo",
    retry: "Tentar novamente",
    failed: "Não deu para carregar o que guardar.",
    noContribution: "Defina um aporte mensal para ver quanto guardar em cada mês.",
    noIncome: "Informe sua renda mensal para ver a sobra depois do aporte.",
    noTarget: "Ainda sem meta",
    noGoal: "Sem objetivo",
    noGoalNote: "Crie um objetivo para este valor.",
    reserveExpected: "Prevista para Setembro de 2030",
    goalExpected: "Previsto para Junho de 2030",
    late: "Previsto para Maio de 2030, 2 meses depois da data",
    beyond: "Não chega em 10 anos",
    reached: "Meta alcançada",
    overHeading: "Categorias acima do limite",
    groceries: "Mercado",
    over: (m: string) => `${m} acima`,
    above: (left: string) => `A sobra de Janeiro é ${left}, depois do aporte. Guardando esse valor também, a reserva chega 2 meses antes.`,
    below: (left: string, short: string) => `A sobra de Janeiro é ${left}: o mês gasta ${short} a mais que a renda.`,
    noneOver: "Nenhuma categoria passou do limite.",
    thisMonth: "Neste mês",
    percent: "41% da meta",
    goalSaved: (m: string) => `${m} guardados · 20% da meta`,
  },
  {
    locale: "en-US",
    heading: "To save in January",
    leftover: "Your January leftover",
    contribution: "Monthly contribution",
    reserve: "Emergency reserve",
    seeSavings: "See savings",
    seeSpending: "See spending",
    setIncome: "Set monthly income",
    setContribution: "Set contribution",
    setTarget: "Set a target",
    addGoal: "Add a Goal",
    retry: "Try again",
    failed: "We could not load what to save.",
    noContribution: "Set a monthly contribution to see how much to save each month.",
    noIncome: "Set your monthly income to see your leftover after your contribution.",
    noTarget: "No target yet",
    noGoal: "No Goal",
    noGoalNote: "Add a Goal for this amount.",
    reserveExpected: "Expected in September 2030",
    goalExpected: "Expected in June 2030",
    late: "Expected in May 2030, 2 months after its date",
    beyond: "Not within 10 years",
    reached: "Target reached",
    overHeading: "Categories over their limit",
    groceries: "Groceries",
    over: (m: string) => `${m} over`,
    above: (left: string) => `Your January leftover is ${left}, after your contribution. Saving that too gets the reserve there 2 months sooner.`,
    below: (left: string, short: string) => `Your January leftover is ${left}: the month takes ${short} more than your income.`,
    noneOver: "No category went over its limit.",
    thisMonth: "This month",
    percent: "41% of the target",
    goalSaved: (m: string) => `${m} saved · 20% of the target`,
  },
] as const;

type Savings = NonNullable<NonNullable<FakeState["finance"]>["savings"]>;

const GOAL = { savedCents: 200000, monthCents: 60000, expectedMonth: "2030-06", late: false };

/** Contribution R$ 1.000,00 (40% to the reserve), a reserve of R$ 41.000,00 of R$ 100.000,00, and two Goals. */
const FULL: Savings = {
  reserveTargetCents: 10000000,
  contributionBaseCents: 100000,
  reserveSharePercent: 40,
  investments: [{ id: "investment-1", name: "Tesouro Selic", valueCents: 4100000, serves: "reserve" }],
  goals: [
    { id: "goal-1", name: "Reforma da cozinha", targetCents: 1000000, targetMonth: null, ...GOAL },
    { id: "goal-2", name: "Viagem", targetCents: 900000, targetMonth: null, savedCents: 0, monthCents: 0, expectedMonth: null, late: false },
  ],
  suggestion: { reserve: { monthCents: 40000, expectedMonth: "2030-09" } },
};

/** January commits R$ 2.500,00, so the leftover is the income less that. */
const stateWith = (savings: Savings | undefined, income: number | null = 350000): FakeState => {
  const s = signedInResident();
  s.user.finance = true;
  s.finance = {
    configured: true,
    sources: [{ id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" }],
    importing: false,
    lastSyncedAt: "2030-01-15T12:00:00Z",
    monthlyIncomeCents: income,
    commitments: [{ month: "2030-01", installments: [], cards: [], otherBills: [], otherInstallmentsCents: 0, planned: [], plannedCents: 0, spentOffCardCents: 0, totalCents: 250000 }],
    ...(savings ? { savings } : {}),
  };
  return s;
};

const withSuggestion = (extra: NonNullable<Savings["suggestion"]>, over: Partial<Savings> = {}): Savings => ({
  ...FULL,
  ...over,
  suggestion: { ...FULL.suggestion, ...extra },
});

/** Whitespace in an expected sentence matches any whitespace, since Intl puts a no-break space after R$. */
const like = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s/g, "\\s"));

/** True when no element under `root` is drawn in the danger colour (text, background or border). */
const noDanger = (root: Locator) =>
  root.evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-danger)";
    document.body.append(probe);
    const danger = getComputedStyle(probe).color;
    probe.remove();
    return [el, ...el.querySelectorAll("*")].every((node) => {
      const s = getComputedStyle(node);
      return [s.color, s.backgroundColor, s.borderTopColor, s.borderBottomColor].every((c) => c !== danger);
    });
  });

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: stateWith(FULL) });

    const money = (cents: number) => new Intl.NumberFormat(l.locale, { style: "currency", currency: "BRL" }).format(cents / 100);
    const open = async (page: Page, baseURL: string | undefined, fakeApi: { use(h: typeof signedInHandlers): void }, path = "/finances") => {
      fakeApi.use(signedInHandlers);
      await page.clock.setFixedTime(new Date("2030-01-15T12:00:00-03:00"));
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL(path, baseURL!).toString());
    };
    const card = (page: Page) => page.getByRole("region", { name: l.heading, exact: true });

    test("leads with the contribution, lists the reserve and each Goal with the amount and the month, and links to Economias", async ({ page, baseURL, fakeApi }) => {
      await open(page, baseURL, fakeApi);
      const c = card(page);
      await expect(c).toContainText(like(money(100000)));
      await expect(c).toContainText(l.contribution);
      const rows = c.getByRole("listitem");
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText(l.reserve);
      await expect(rows.nth(0)).toContainText(like(money(40000)));
      await expect(rows.nth(0)).toContainText(l.reserveExpected);
      await expect(rows.nth(1)).toContainText("Reforma da cozinha");
      await expect(rows.nth(1)).toContainText(like(money(60000)));
      await expect(rows.nth(1)).toContainText(l.goalExpected);
      // The leftover (R$ 1.000,00) equals the contribution: no comparison sentence and no button anywhere in the card.
      await expect(c).not.toContainText(l.leftover);
      await expect(c.getByRole("button")).toHaveCount(0);
      // Under the leftover card, above the pace chart.
      const order = await page.getByRole("region").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
      expect(order.indexOf(l.heading)).toBe(1);
      await c.getByRole("link", { name: l.seeSavings }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/finances/economias");
    });

    test.describe("above the contribution", () => {
      test.use({ fakeState: stateWith(withSuggestion({ leftover: { leftoverCents: 200000, extraCents: 100000, monthsSooner: 2 } }), 450000) });

      test("says how much more could be saved and how much sooner, with no button", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        const c = card(page);
        await expect(c).toContainText(like(l.above(money(200000))));
        await expect(c.getByRole("button")).toHaveCount(0);
        await expect(c.getByRole("link")).toHaveCount(1);
        expect(await noDanger(c)).toBe(true);
      });
    });

    test.describe("above the contribution without a date that moves", () => {
      test.use({ fakeState: stateWith(withSuggestion({ leftover: { leftoverCents: 200000, extraCents: 100000, monthsSooner: 0 } }), 450000) });

      test("leaves the sooner sentence out", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        await expect(card(page)).toContainText(like(`${money(200000)}, ${l.locale === "pt-BR" ? "depois do aporte" : "after your contribution"}`));
        await expect(card(page)).not.toContainText(/2 (meses antes|months sooner)|(meses antes|months sooner)/);
      });
    });

    test.describe("below the contribution with a Category over", () => {
      test.use({ fakeState: stateWith(withSuggestion({ overLimit: [{ category: "groceries", overCents: 12000 }] }), 200000) });

      test("lists the Categories over their limit in neutral words, with a link to Gastos", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        const c = card(page);
        await expect(c).toContainText(like(l.below(money(-50000), money(50000))));
        await expect(c.getByRole("heading", { name: l.overHeading })).toBeVisible();
        await expect(c).toContainText(l.groceries);
        await expect(c).toContainText(like(l.over(money(12000))));
        await expect(c.getByRole("alert")).toHaveCount(0);
        expect(await noDanger(c)).toBe(true);
        await c.getByRole("link", { name: l.seeSpending }).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances/gastos");
      });
    });

    test.describe("below the contribution with none over", () => {
      test.use({ fakeState: stateWith(withSuggestion({ overLimit: [] }), 200000) });

      test("says the month is tight without naming a category", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        const c = card(page);
        await expect(c).toContainText(like(l.below(money(-50000), money(50000))));
        await expect(c).toContainText(l.noneOver);
        await expect(c.getByRole("heading", { name: l.overHeading })).toHaveCount(0);
      });
    });

    test.describe("without a Monthly income", () => {
      test.use({ fakeState: stateWith(FULL, null) });

      test("asks for the income and links to Ajustes", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        const c = card(page);
        await expect(c).toContainText(l.noIncome);
        await c.getByRole("link", { name: l.setIncome }).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances/ajustes");
      });
    });

    test.describe("without a Monthly contribution", () => {
      test.use({ fakeState: stateWith({ ...FULL, contributionBaseCents: null, reserveSharePercent: null, goals: [], suggestion: {} }) });

      test("says what is missing and links to Economias", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        const c = card(page);
        await expect(c).toContainText(l.noContribution);
        await expect(c.getByRole("listitem")).toHaveCount(0);
        await c.getByRole("link", { name: l.setContribution }).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances/economias");
      });
    });

    test.describe("without a reserve target, with money no Goal takes", () => {
      test.use({
        fakeState: stateWith({ ...FULL, reserveTargetCents: null, investments: [], goals: [], suggestion: { unassignedCents: 100000 } }),
      });

      test("says the reserve has no target and the money has no Goal, each with its link", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        const c = card(page);
        await expect(c.getByRole("listitem").nth(0)).toContainText(l.noTarget);
        await expect(c.getByRole("link", { name: l.setTarget })).toBeVisible();
        await expect(c.getByRole("listitem").nth(1)).toContainText(l.noGoal);
        await expect(c.getByRole("listitem").nth(1)).toContainText(l.noGoalNote);
        await c.getByRole("link", { name: l.addGoal }).click();
        await expect(page).toHaveURL((url) => url.pathname === "/finances/economias");
      });
    });

    test.describe("with a late Goal, one beyond 10 years and a full one", () => {
      test.use({
        fakeState: stateWith({
          ...FULL,
          goals: [
            { id: "goal-1", name: "Reforma", targetCents: 1000000, targetMonth: "2030-03", savedCents: 0, monthCents: 60000, expectedMonth: "2030-05", late: true },
            { id: "goal-2", name: "Casa", targetCents: 90000000, targetMonth: null, savedCents: 0, monthCents: 0, expectedMonth: null, late: false },
            { id: "goal-3", name: "Notebook", targetCents: 800000, targetMonth: null, savedCents: 800000, monthCents: 0, expectedMonth: null, late: false },
          ],
        }),
      });

      test("says so instead of a date, and a full Goal has no monthly amount", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi);
        const rows = card(page).getByRole("listitem");
        await expect(rows.nth(1)).toContainText(l.late);
        await expect(rows.nth(2)).toContainText(l.beyond);
        await expect(rows.nth(3)).toContainText(l.reached);
        await expect(rows.nth(3)).not.toContainText("R$");
        await expect(rows.nth(3)).not.toContainText("$0");
      });
    });

    test.describe("when the savings cannot be read", () => {
      test("only this card says so, with Retry, and the leftover card stays", async ({ page, baseURL, fakeApi }) => {
        fakeApi.use(signedInHandlers);
        fakeApi.override("GET /me/finance/savings", { status: 500, body: { error: "boom" } }, { once: true });
        await page.clock.setFixedTime(new Date("2030-01-15T12:00:00-03:00"));
        await seedSession(page, { email: RESIDENT_EMAIL });
        await visit(page, new URL("/finances", baseURL!).toString());
        const c = card(page);
        await expect(c.getByRole("alert")).toContainText(l.failed);
        await expect(page.getByRole("region", { name: l.leftover, exact: true })).toBeVisible();
        await c.getByRole("button", { name: l.retry }).click();
        await expect(c).toContainText(l.reserve);
        await expect(c.getByRole("alert")).toHaveCount(0);
      });
    });

    test.describe("in Economias", () => {
      test("each progress has its amounts in text, this month's amount and the expected month", async ({ page, baseURL, fakeApi }) => {
        await open(page, baseURL, fakeApi, "/finances/economias");
        const reserve = page.getByRole("region", { name: l.reserve, exact: true });
        await expect(reserve).toContainText(like(money(4100000)));
        await expect(reserve).toContainText(l.percent);
        await expect(reserve).toContainText(l.thisMonth);
        await expect(reserve).toContainText(like(money(40000)));
        await expect(reserve).toContainText(l.reserveExpected);
        const goals = page.getByRole("region", { name: l.locale === "pt-BR" ? "Objetivos" : "Goals", exact: true });
        await expect(goals).toContainText(like(l.goalSaved(money(200000))));
        await expect(goals).toContainText(l.goalExpected);
      });
    });

    for (const theme of ["light", "dark"] as const) {
      test.describe(`at 320px and the largest text, ${theme}`, () => {
        test.use({ fakeState: stateWith(withSuggestion({ overLimit: [{ category: "groceries", overCents: 12000 }] }, { goals: [{ id: "goal-1", name: "Reforma da cozinha e da área de serviço", targetCents: 1000000, targetMonth: "2030-03", savedCents: 0, monthCents: 60000, expectedMonth: "2030-05", late: true }] }), 300000) });

        test("nothing overflows sideways in Resumo or Economias", async ({ page, baseURL, fakeApi }) => {
          await page.setViewportSize({ width: 320, height: 640 });
          await page.addInitScript((value) => {
            localStorage.setItem("homeowner.theme", value);
            document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
          }, theme);
          await open(page, baseURL, fakeApi);
          await expect(card(page)).toContainText(l.late);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          expect(await noSideScroll(page)).toBe(true);
          expect(await noDanger(card(page))).toBe(true);
          await visit(page, new URL("/finances/economias", baseURL!).toString());
          await expect(page.getByRole("region", { name: l.reserve, exact: true })).toContainText(l.thisMonth);
          expect(await noSideScroll(page)).toBe(true);
        });
      });
    }
  });
}
