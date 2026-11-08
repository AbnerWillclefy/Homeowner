import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, pt-BR first and then English, with the clock fixed on 15 November 2026: "Próximos meses" (in the
// Contas view) draws every month with a commitment as a bar split into Bills and installments, with each total and the
// split as text, labels the current month as only the Bills still to pay, lists the Installment plans in progress with
// the next part, the total and the last month (one that ends this month, one that crosses into next year), and
// shows the Monthly income as text and a line on every bar once it is set, with no alarm word, icon or exclamation
// mark, even above 100%. The income is not edited there: a link goes to Ajustes, where the field is, with its messages.
// No commitments is said calmly. At 320px with the root font at 200% nothing overflows sideways.

const LOCALES = [
  {
    locale: "pt-BR",
    heading: "Próximos meses",
    bills: "Contas",
    settings: "Ajustes",
    income: "Renda mensal",
    save: "Salvar",
    clear: "Remover",
    november: /novembro de 2026: R\$\s*320,00/i,
    december: /dezembro de 2026: R\$\s*870,00/i,
    january: /janeiro de 2027: R\$\s*570,00/i,
    split: /Contas R\$\s*120,00 · Parcelamentos R\$\s*750,00/,
    currentNote: "Só contas ainda a pagar",
    plansHeading: "Parcelamentos em andamento",
    plans: ["Sofá: próxima 3 de 3 · última em novembro", "Geladeira: próxima 4 de 10 · última em junho", "Televisão: próxima 2 de 6 · última em abril"],
    incomeText: /Renda mensal: R\$\s*600,00/,
    change: "Alterar renda",
    set: "Informar renda mensal",
    marker: "A linha em cada barra marca a sua renda mensal.",
    empty: "Nenhuma conta ou parcelamento nos próximos meses.",
    failed: "Não conseguimos carregar os parcelamentos. Verifique sua conexão e tente de novo.",
    retry: "Tentar novamente",
    problems: { empty: "Digite sua renda mensal, por exemplo 5.000,00.", zero: "A renda mensal precisa ser maior que zero.", junk: "Use só números, por exemplo 5.000,00." },
    typed: { high: "600,00" },
  },
  {
    locale: "en-US",
    heading: "Coming months",
    bills: "Bills",
    settings: "Settings",
    income: "Monthly income",
    save: "Save",
    clear: "Clear",
    november: /November 2026: R\$\s*320\.00/i,
    december: /December 2026: R\$\s*870\.00/i,
    january: /January 2027: R\$\s*570\.00/i,
    split: /Bills R\$\s*120\.00 · Installments R\$\s*750\.00/,
    currentNote: "Only bills still to pay",
    plansHeading: "Installment plans in progress",
    plans: ["Sofá: next 3 of 3 · last in November", "Geladeira: next 4 of 10 · last in June", "Televisão: next 2 of 6 · last in April"],
    incomeText: /Monthly income: R\$\s*600\.00/,
    change: "Change income",
    set: "Set monthly income",
    marker: "The line on each bar marks your monthly income.",
    empty: "No bills or installments in the coming months.",
    failed: "We could not load the installments. Check your connection and try again.",
    retry: "Try again",
    problems: { empty: "Enter your monthly income, for example 5,000.00.", zero: "Monthly income must be more than zero.", junk: "Use numbers only, for example 5,000.00." },
    typed: { high: "600.00" },
  },
] as const;

const connected = (withMonths: boolean) => {
  const s = signedInResident();
  s.user.finance = true;
  s.finance = {
    configured: true,
    sources: [{ id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" }],
    importing: false,
    lastSyncedAt: "2026-11-08T13:05:00Z",
    commitments: withMonths
      ? [
          {
            month: "2026-11",
            committedCents: 32000,
            installments: [{ name: "Sofá", number: 3, total: 3, amountCents: 20000 }],
            bills: [{ id: "bill-1", name: "Internet", expectedCents: 12000 }],
          },
          {
            month: "2026-12",
            committedCents: 87000,
            installments: [
              { name: "Geladeira", number: 4, total: 10, amountCents: 45000 },
              { name: "Televisão", number: 2, total: 6, amountCents: 30000 },
            ],
            bills: [{ id: "bill-1", name: "Internet", expectedCents: 12000 }],
          },
          {
            month: "2027-01",
            committedCents: 57000,
            installments: [{ name: "Geladeira", number: 5, total: 10, amountCents: 45000 }],
            bills: [{ id: "bill-1", name: "Internet", expectedCents: 12000 }],
          },
        ]
      : [{ month: "2026-12", committedCents: 0, installments: [], bills: [] }],
  };
  return s;
};

const section = (page: Page, heading: string) => page.getByRole("region", { name: heading, exact: true });

/** Opens a Finances view and returns its panel. */
async function view(page: Page, name: string) {
  // Ajustes is a route behind a button beside the title, not a tab.
  if (name === "Ajustes" || name === "Settings") {
    await page.getByRole("link", { name, exact: true }).click();
    return page.locator("main");
  }
  // Ajustes is a route: leave it before picking a tab.
  if (page.url().endsWith("/finances/ajustes")) await page.getByRole("button", { name: /^(Voltar|Back)$/ }).click();
  await page.getByRole("tab", { name }).click();
  return page.getByRole("tabpanel", { name });
}
/** The income form alone: the Settings view has other forms with their own alerts. */
const income = (page: Page) => page.locator("form").filter({ has: page.getByLabel(/^(Renda mensal|Monthly income)$/) });

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await page.clock.setFixedTime(new Date("2026-11-15T12:00:00-03:00"));
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
    });

    const comingMonths = async (page: Page) => {
      await view(page, l.bills);
      return section(page, l.heading);
    };

    test.describe("with commitments", () => {
      test.use({ fakeState: connected(true) });

      test("draws each month as a bar split into Bills and installments, with every total as text", async ({ page }) => {
        const s = await comingMonths(page);
        await expect(s.getByText(l.november)).toBeVisible();
        await expect(s.getByText(l.december)).toBeVisible();
        await expect(s.getByText(l.january)).toBeVisible();
        await expect(s.getByText(l.split)).toBeVisible();
        await expect(s.getByRole("listitem").filter({ hasText: l.december }).locator("[data-fill]")).toHaveCount(2);
        await expect(s.getByText(l.currentNote)).toHaveCount(1);
      });

      test("lists the plans in progress with the next part, the total and the last month", async ({ page }) => {
        const s = await comingMonths(page);
        await expect(s.getByRole("heading", { name: l.plansHeading })).toBeVisible();
        for (const text of l.plans) await expect(s.getByText(text)).toBeVisible();
        // A plan that appears in two months is listed once.
        await expect(s.getByText(/Geladeira/)).toHaveCount(1);
      });

      test("without income the bars have no income line, and a link offers to set it", async ({ page }) => {
        const s = await comingMonths(page);
        await expect(s.locator("[data-marker]")).toHaveCount(0);
        await expect(s.getByText(l.incomeText)).toHaveCount(0);
        await expect(s.getByRole("link", { name: l.set })).toBeVisible();
        await view(page, l.settings);
        await expect(income(page).getByRole("button", { name: l.clear })).toHaveCount(0);
        await expect(page.getByLabel(l.income)).toHaveValue("");
      });

      test("setting an income shows it as text and a line on every bar, without alarm; clearing removes them", async ({ page }) => {
        let s = await comingMonths(page);
        await s.getByRole("link", { name: l.set }).click();
        await expect(page).toHaveURL(/\/finances\/ajustes$/);
        await page.getByLabel(l.income).fill(l.typed.high);
        await income(page).getByRole("button", { name: l.save }).click();
        await expect(page.getByLabel(l.income)).toHaveValue(l.typed.high);
        await expect(income(page).getByRole("alert")).toBeEmpty();

        s = await comingMonths(page);
        await expect(s.getByText(l.incomeText)).toBeVisible();
        await expect(s.getByText(l.marker)).toBeVisible();
        await expect(s.locator("[data-marker]")).toHaveCount(3);
        await expect(s.getByRole("link", { name: l.change })).toBeVisible();
        expect(await s.innerText()).not.toContain("!");
        await expect(s.locator("svg.lucide-triangle-alert, svg.lucide-circle-alert")).toHaveCount(0);

        await view(page, l.settings);
        await income(page).getByRole("button", { name: l.clear }).click();
        await expect(page.getByLabel(l.income)).toHaveValue("");
        s = await comingMonths(page);
        await expect(s.getByText(l.incomeText)).toHaveCount(0);
        await expect(s.locator("[data-marker]")).toHaveCount(0);
        await expect(s.getByText(l.december)).toBeVisible();
      });

      test("an income that is empty, zero or not a number is explained and not sent", async ({ page, fakeApi }) => {
        await view(page, l.settings);
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
        expect(fakeApi.requests.filter((r) => r.path === "/me/finance/income")).toEqual([]);
      });
    });

    test.describe("without commitments", () => {
      test.use({ fakeState: connected(false) });

      test("says so calmly and still offers the income", async ({ page }) => {
        const s = await comingMonths(page);
        await expect(s.getByText(l.empty)).toBeVisible();
        await expect(s.getByRole("link", { name: l.set })).toBeVisible();
        await view(page, l.settings);
        await expect(page.getByLabel(l.income)).toBeVisible();
      });
    });

    test.describe("when the commitments cannot be read", () => {
      test.use({ fakeState: connected(true) });

      test("Settings says so where the income was, with Retry", async ({ page, fakeApi }) => {
        fakeApi.override("GET /me/finance/commitments", { status: 500, body: { error: "boom" } });
        await page.reload();
        const settings = await view(page, l.settings);
        await expect(settings.getByRole("alert").filter({ hasText: l.failed })).toBeVisible();
        await expect(settings.getByRole("button", { name: l.retry })).toBeVisible();
      });
    });

    test.describe("at 320px and the largest text", () => {
      test.use({ fakeState: connected(true), viewport: { width: 320, height: 640 } });

      test("nothing overflows sideways", async ({ page }) => {
        await page.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
        });
        await page.reload();
        await view(page, l.settings);
        await page.getByLabel(l.income).fill(l.typed.high);
        await income(page).getByRole("button", { name: l.save }).click();
        await expect(page.getByLabel(l.income)).toHaveValue(l.typed.high);
        const s = await comingMonths(page);
        await expect(s.getByText(l.plans[0])).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      });
    });
  });
}
