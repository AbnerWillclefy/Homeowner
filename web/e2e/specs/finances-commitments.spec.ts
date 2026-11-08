import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, in both locales: the Installments section (in the Bills view) lists the coming months with their committed amount in
// BRL and no percentage until a Monthly income is set; setting the income shows the share (also above 100%, with no
// alarm word, icon or exclamation mark); clearing it takes the shares away; a month opens to its components; a
// bad income gets a message; and no installments is said calmly. The Monthly income field is in the Settings view. At 320px with the root font at 200% nothing
// overflows sideways. The 320px runs also save the screenshots for the pull request description.

const LOCALES = [
  {
    locale: "pt-BR",
    file: "pt-BR",
    heading: "Parcelamentos",
    bills: "Contas",
    settings: "Ajustes",
    income: "Renda mensal",
    save: "Salvar",
    clear: "Remover",
    december: /dezembro de 2026/i,
    january: /janeiro de 2027/i,
    dec: /R\$\s*870,00/,
    jan: /R\$\s*570,00/,
    pct: (n: number) => `${n}% da renda já comprometido`,
    sharePattern: /da renda/,
    fridge: "Geladeira 4 de 10",
    bill: "Internet",
    empty: "Nenhum parcelamento nos próximos meses.",
    failed: "Não conseguimos carregar os parcelamentos. Verifique sua conexão e tente de novo.",
    retry: "Tentar novamente",
    problems: { empty: "Digite sua renda mensal, por exemplo 5.000,00.", zero: "A renda mensal precisa ser maior que zero.", junk: "Use só números, por exemplo 5.000,00." },
    typed: { high: "600,00", low: "5.000,00" },
  },
  {
    locale: "en-US",
    file: "en",
    heading: "Installments",
    bills: "Bills",
    settings: "Settings",
    income: "Monthly income",
    save: "Save",
    clear: "Clear",
    december: /December 2026/i,
    january: /January 2027/i,
    dec: /R\$870\.00/,
    jan: /R\$570\.00/,
    pct: (n: number) => `${n}% of income already committed`,
    sharePattern: /of income/,
    fridge: "Geladeira 4 of 10",
    bill: "Internet",
    empty: "No installments in the coming months.",
    failed: "We could not load the installments. Check your connection and try again.",
    retry: "Try again",
    problems: { empty: "Enter your monthly income, for example 5,000.00.", zero: "Monthly income must be more than zero.", junk: "Use numbers only, for example 5,000.00." },
    typed: { high: "600.00", low: "5,000.00" },
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
    await page.getByRole("link", { name }).click();
    return page.locator("main");
  }
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
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
    });

    const installments = async (page: Page) => {
      await view(page, l.bills);
      return section(page, l.heading);
    };

    test.describe("with installments", () => {
      test.use({ fakeState: connected(true) });

      test("without income shows amounts only, and the income field is not required", async ({ page }) => {
        const s = await installments(page);
        await expect(s.getByText(l.dec)).toBeVisible();
        await expect(s.getByText(l.jan)).toBeVisible();
        await expect(s.getByText(l.sharePattern)).toHaveCount(0);
        await view(page, l.settings);
        await expect(income(page).getByRole("button", { name: l.clear })).toHaveCount(0);
        await expect(page.getByLabel(l.income)).toHaveValue("");
      });

      test("setting an income shows the shares, above 100% too, without alarm; clearing removes them", async ({ page }) => {
        await view(page, l.settings);
        await page.getByLabel(l.income).fill(l.typed.high);
        await income(page).getByRole("button", { name: l.save }).click();
        await expect(page.getByLabel(l.income)).toHaveValue(l.typed.high);
        await expect(income(page).getByRole("alert")).toBeEmpty();
        let s = await installments(page);
        await expect(s.getByText(l.pct(145))).toBeVisible();
        await expect(s.getByText(l.pct(95))).toBeVisible();
        expect(await s.innerText()).not.toContain("!");
        await expect(s.locator("svg.lucide-triangle-alert, svg.lucide-circle-alert")).toHaveCount(0);

        await view(page, l.settings);
        await page.getByLabel(l.income).fill(l.typed.low);
        await income(page).getByRole("button", { name: l.save }).click();
        s = await installments(page);
        await expect(s.getByText(l.pct(17))).toBeVisible();

        await view(page, l.settings);
        await income(page).getByRole("button", { name: l.clear }).click();
        await expect(page.getByLabel(l.income)).toHaveValue("");
        s = await installments(page);
        await expect(s.getByText(l.sharePattern)).toHaveCount(0);
        await expect(s.getByText(l.dec)).toBeVisible();
      });

      test("opening a month shows its installments and Bills", async ({ page }) => {
        const s = await installments(page);
        const month = s.getByRole("button", { name: l.december });
        await expect(month).toHaveAttribute("aria-expanded", "false");
        await month.click();
        await expect(s.getByText(l.fridge)).toBeVisible();
        await expect(s.getByRole("region", { name: l.december }).getByText(l.bill)).toBeVisible();
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

    test.describe("without installments", () => {
      test.use({ fakeState: connected(false) });

      test("says so calmly and still offers the income", async ({ page }) => {
        const s = await installments(page);
        await expect(s.getByText(l.empty)).toBeVisible();
        await view(page, l.settings);
        await expect(page.getByLabel(l.income)).toBeVisible();
      });
    });

    test.describe("when the installments cannot be read", () => {
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
        const s = await installments(page);
        await s.getByRole("button", { name: l.december }).click();
        await expect(s.getByText(l.fridge)).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        // Kept under test-results/ for the pull request description; the sticky tab bar would cover the card.
        await page.getByRole("navigation").evaluate((nav) => (nav.style.display = "none"));
        await s.screenshot({ path: test.info().outputPath(`commitments-${l.file}.png`) });
      });
    });
  });
}
