import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, pt-BR first and then English, with the clock fixed on 2030-01-15: Contas has the Gastos month picker,
// starting on the current month and unable to go past it. A past month lists its Bills as history: a paid Bill shows the
// expected and the paid amount as text when they differ (one amount when equal), an unpaid one sits in "Sem pagamento"
// (never "Vencida"), the due-date strip marks no today, and "Paguei", "Desfazer", "⋯" and "Adicionar conta" are absent.
// A month before any Bill existed says so calmly. Stepping back to the current month restores the actions, and "Próximos
// meses" shows only there. At 320px with the root font at 200% a past month does not overflow sideways.

const LOCALES = [
  {
    locale: "pt-BR",
    group: "Mês das contas",
    prev: "Mês anterior",
    next: "Próximo mês",
    january: /janeiro de 2030/i,
    december: /dezembro de 2029/i,
    november: /novembro de 2029/i,
    markPaid: /Paguei/,
    undo: /Desfazer/,
    menu: /Mais ações/,
    add: "Adicionar conta",
    both: /Previsto R\$\s*1\.500,00 · Pago R\$\s*1\.480,00/,
    equalOnly: /^R\$\s*210,50$/,
    summary: { paid: /Pago R\$\s*1\.690,50/, toPay: /Falta pagar R\$\s*99,90/ },
    groups: { unpaid: "Sem pagamento", paid: "Pagas" },
    dueOn: /Vencimento 10 de dez/,
    stripNone: /Hoje é dia/,
    empty: "Nenhuma conta neste mês.",
    coming: "Próximos meses",
    bills: "Contas",
  },
  {
    locale: "en-US",
    group: "Bills month",
    prev: "Previous month",
    next: "Next month",
    january: /January 2030/i,
    december: /December 2029/i,
    november: /November 2029/i,
    markPaid: /I paid/,
    undo: /Undo/,
    menu: /More actions/,
    add: "Add a bill",
    both: /Expected R\$\s*1,500\.00 · Paid R\$\s*1,480\.00/,
    equalOnly: /^R\$\s*210\.50$/,
    summary: { paid: /Paid R\$\s*1,690\.50/, toPay: /Still to pay R\$\s*99\.90/ },
    groups: { unpaid: "No payment", paid: "Paid" },
    dueOn: /Due date Dec 10/,
    stripNone: /Today is day/,
    empty: "No bills this month.",
    coming: "Coming months",
    bills: "Bills",
  },
] as const;

const DEC = "2029-12";
const state = (sources: boolean) => {
  const s = signedInResident();
  s.user.finance = true;
  s.finance = {
    configured: sources,
    sources: sources ? [{ id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" }] : [],
    importing: false,
    lastSyncedAt: null,
    bills: [
      { id: "b1", name: "Aluguel", expectedCents: 150000, dueDay: 5, paid: { [DEC]: "hand" }, paidCents: { [DEC]: 148000 }, createdMonth: DEC },
      { id: "b2", name: "Luz", expectedCents: 21050, dueDay: 20, paid: { [DEC]: "bank" }, createdMonth: DEC },
      { id: "b3", name: "Internet", expectedCents: 9990, dueDay: 10, paid: {}, createdMonth: DEC },
      { id: "b4", name: "Gás", expectedCents: 4000, dueDay: 12, paid: {}, createdMonth: "2030-01" },
    ],
  };
  return s;
};

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: state(false) });

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await page.clock.setFixedTime(new Date("2030-01-15T12:00:00-03:00"));
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
    });

    const row = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });
    const picker = (page: Page) => page.getByRole("group", { name: l.group });
    const back = (page: Page) => picker(page).getByRole("button", { name: l.prev }).click();

    test("starts on the current month and cannot go past it", async ({ page }) => {
      await expect(picker(page)).toContainText(l.january);
      await expect(picker(page).getByRole("button", { name: l.next })).toBeDisabled();
      await expect(row(page, "Gás").getByRole("button", { name: l.markPaid })).toBeVisible();
    });

    test("a past month shows expected and paid as text, with no actions and no today", async ({ page }) => {
      await back(page);
      await expect(picker(page)).toContainText(l.december);
      await expect(row(page, "Aluguel")).toContainText(l.both);
      await expect(row(page, "Luz").getByText(l.equalOnly)).toBeVisible();
      await expect(row(page, "Internet")).toContainText(l.dueOn);
      await expect(row(page, "Gás")).toHaveCount(0);
      await expect(page.getByText(l.summary.paid)).toBeVisible();
      await expect(page.getByText(l.summary.toPay)).toBeVisible();
      await expect(page.getByRole("region", { name: new RegExp(`^${l.groups.unpaid}`) }).getByText("Internet")).toBeVisible();
      await expect(page.getByRole("region", { name: new RegExp(`^${l.groups.paid}`) }).getByText("Aluguel")).toBeVisible();

      await expect(page.getByRole("button", { name: l.markPaid })).toHaveCount(0);
      await expect(page.getByRole("button", { name: l.undo })).toHaveCount(0);
      await expect(page.getByRole("button", { name: l.menu })).toHaveCount(0);
      await expect(page.getByRole("button", { name: l.add })).toHaveCount(0);
      await expect(page.locator("[data-today]")).toHaveCount(0);
      await expect(page.getByRole("img", { name: l.stripNone })).toHaveCount(0);
    });

    test("a month before any Bill existed says so calmly", async ({ page }) => {
      await back(page);
      await back(page);
      await expect(picker(page)).toContainText(l.november);
      await expect(page.getByText(l.empty)).toBeVisible();
      await expect(page.getByRole("button", { name: l.add })).toHaveCount(0);
    });

    test("going forward again restores the actions", async ({ page }) => {
      await back(page);
      await picker(page).getByRole("button", { name: l.next }).click();
      await expect(picker(page)).toContainText(l.january);
      await expect(row(page, "Gás").getByRole("button", { name: l.markPaid })).toBeVisible();
      await expect(page.getByRole("button", { name: l.add })).toBeVisible();
    });

    test("at 320px and the largest text a past month does not overflow sideways", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await back(page);
      await expect(row(page, "Aluguel")).toContainText(l.both);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });

  test.describe(`${l.locale}, with a Source`, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: state(true) });

    test("Próximos meses shows on the current month only", async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await page.clock.setFixedTime(new Date("2030-01-15T12:00:00-03:00"));
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
      await page.getByRole("tab", { name: l.bills }).click();
      const coming = page.getByRole("heading", { name: l.coming, exact: true });
      await expect(coming).toBeVisible();
      await page.getByRole("group", { name: l.group }).getByRole("button", { name: l.prev }).click();
      await expect(coming).toHaveCount(0);
      await page.getByRole("group", { name: l.group }).getByRole("button", { name: l.next }).click();
      await expect(coming).toBeVisible();
    });
  });
}
