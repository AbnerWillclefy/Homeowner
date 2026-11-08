import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, in pt-BR: the Finances tab lists the month's Bills to pay with amount, due date and a state
// in words (Paid, Paid from your bank, To pay, Was due ...), adds a Bill with validation messages beside the fields,
// marks one paid and undoes it by hand, deletes one after a confirmation, and states an overdue Bill plainly. At 320px
// with the root font at 200% nothing overflows sideways. The clock is fixed at 2030-01-15.

const LOCALES = [
  {
    locale: "pt-BR",
    add: "Adicionar conta",
    nameLabel: "Nome",
    amountLabel: "Valor esperado (R$)",
    dayLabel: "Dia do vencimento",
    save: "Salvar",
    markPaid: "Marcar como paga",
    undo: "Desfazer",
    del: "Excluir",
    paid: "Paga",
    bank: "Paga pelo banco",
    due: "A pagar",
    overdue: /Venceu em 5 de jan/,
    nameRequired: "Dê um nome à conta.",
    amountInvalid: "Digite um valor como 1.234,56.",
    dayInvalid: "Digite um dia de 1 a 31.",
    amount: "1.234,56",
    shown: /R\$\s*1\.234,56/,
    empty: "Uma conta a pagar vence todo mês, como aluguel ou luz. Adicione a primeira.",
  },
] as const;

const connected = (withBills = true) => {
  const s = signedInResident();
  s.user.finance = true;
  s.finance = {
    configured: false,
    sources: [],
    importing: false,
    lastSyncedAt: null,
    bills: withBills
      ? [
          { id: "b1", name: "Aluguel", expectedCents: 150000, dueDay: 5, paid: {} },
          { id: "b2", name: "Luz", expectedCents: 21050, dueDay: 20, paid: {} },
          { id: "b3", name: "Internet", expectedCents: 9990, dueDay: 10, paid: { "2030-01": "bank" } },
          { id: "b4", name: "Água", expectedCents: 6000, dueDay: 12, paid: { "2030-01": "hand" } },
        ]
      : [],
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

    const row = (page: import("@playwright/test").Page, name: string) => page.getByRole("listitem").filter({ hasText: name });

    test("adding a bill shows what is wrong beside each field, then lists it", async ({ page, fakeApi }) => {
      await page.getByRole("button", { name: l.add }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: l.save }).click();
      await expect(dialog.getByText(l.nameRequired)).toBeVisible();
      await expect(dialog.getByText(l.amountInvalid)).toBeVisible();
      await expect(dialog.getByText(l.dayInvalid)).toBeVisible();
      await expect(dialog.getByLabel(l.nameLabel)).toHaveAttribute("aria-invalid", "true");

      await dialog.getByLabel(l.nameLabel).fill("Gás");
      await dialog.getByLabel(l.amountLabel).fill(l.amount);
      await dialog.getByLabel(l.dayLabel).fill("31");
      await dialog.getByRole("button", { name: l.save }).click();

      await expect(dialog).toHaveCount(0);
      expect(fakeApi.requests.find((r) => r.method === "POST" && r.path === "/me/finance/bills")?.body).toEqual({
        name: "Gás",
        expectedCents: 123456,
        dueDay: 31,
      });
      const added = row(page, "Gás");
      await expect(added.getByText(l.shown)).toBeVisible();
      await expect(added.getByText(l.due, { exact: true })).toBeVisible();
    });

    test("marking a bill paid, then undoing it", async ({ page, fakeApi }) => {
      const luz = row(page, "Luz");
      await expect(luz.getByText(l.due, { exact: true })).toBeVisible();
      await luz.getByRole("button", { name: new RegExp(l.markPaid) }).click();
      await expect(luz.getByText(l.paid, { exact: true })).toBeVisible();
      await expect(luz.getByRole("button", { name: new RegExp(l.markPaid) })).toHaveCount(0);
      expect(fakeApi.requests.some((r) => r.method === "PUT" && r.path === "/me/finance/bills/b2/payments/2030-01")).toBe(true);

      await luz.getByRole("button", { name: new RegExp(l.undo) }).click();
      await expect(luz.getByText(l.due, { exact: true })).toBeVisible();
      expect(fakeApi.requests.some((r) => r.method === "DELETE" && r.path === "/me/finance/bills/b2/payments/2030-01")).toBe(true);
    });

    test("deleting a bill asks first", async ({ page, fakeApi }) => {
      await row(page, "Luz").getByRole("button", { name: new RegExp(`${l.del}: Luz`) }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: l.del }).click();
      await expect(dialog).toHaveCount(0);
      await expect(row(page, "Luz")).toHaveCount(0);
      expect(fakeApi.requests.some((r) => r.method === "DELETE" && r.path === "/me/finance/bills/b2")).toBe(true);
    });

    test("a bill paid by the bank says so, and an overdue one is stated plainly", async ({ page }) => {
      await expect(row(page, "Internet").getByText(l.bank)).toBeVisible();
      await expect(row(page, "Água").getByText(l.paid, { exact: true })).toBeVisible();
      const aluguel = row(page, "Aluguel");
      await expect(aluguel.getByText(l.overdue)).toBeVisible();
      expect(await aluguel.innerText()).not.toContain("!");
    });

    test("at 320px and the largest text nothing overflows sideways", async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
      });
      await visit(page, new URL("/finances", baseURL!).toString());
      await expect(row(page, "Aluguel").getByText(l.overdue)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });

  test.describe(`${l.locale}, no bills`, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: connected(false) });

    test("the empty state explains what a bill to pay is", async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
      await expect(page.getByText(l.empty)).toBeVisible();
    });
  });
}
