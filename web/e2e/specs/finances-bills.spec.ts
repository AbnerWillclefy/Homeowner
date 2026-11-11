import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, pt-BR first and then English: Contas shows paid against still to pay as text that agrees with the
// group totals, a strip of the month's days that marks today and counts two Bills on one day, and the Bills in groups
// (Vencida, A pagar, Pagas; an empty one is hidden). A Bill is added with validation beside the fields, marked paid and
// undone, edited and deleted from the "⋯" menu (reached by keyboard: Enter, arrows, Escape) with a confirmation first.
// A Bill paid by the bank has no Undo. At 320px with the root font at 200% nothing overflows sideways. The clock is
// fixed at 2030-01-15.

const LOCALES = [
  {
    locale: "pt-BR",
    add: "Adicionar conta",
    nameLabel: "Nome",
    amountLabel: "Valor esperado (R$)",
    dayLabel: "Dia do vencimento",
    save: "Salvar",
    cancel: "Cancelar",
    markPaid: /Paguei/,
    undo: /Desfazer/,
    del: "Excluir",
    edit: "Editar",
    editTitle: "Editar conta",
    menu: (name: string) => `Mais ações: ${name}`,
    paid: "Paga",
    bank: "Paga pelo banco",
    dueLine: /Vence 20 de Jan/,
    addedDue: /Vence 31 de Jan/,
    overdue: /Venceu em 5 de Jan/,
    groups: { overdue: "Vencida", due: "A pagar", paid: "Pagas" },
    summary: { paid: /R\$\s*159,90 de R\$\s*2\.170,40 pagos\./, toPay: /Faltam R\$\s*2\.010,50 em 3 contas\./ },
    strip: { twoOnTwenty: /Dia 20: 2 contas/, today: /Hoje é dia 15/, mark: "hoje" },
    nameRequired: "Dê um nome à conta.",
    amountInvalid: "Digite um valor como 1.234,56.",
    dayInvalid: "Digite um dia de 1 a 31.",
    amount: "1.234,56",
    shown: /R\$\s*1\.234,56/,
    empty: "Uma conta a pagar vence todo mês, como aluguel ou luz. Adicione a primeira.",
  },
  {
    locale: "en-US",
    add: "Add a bill",
    nameLabel: "Name",
    amountLabel: "Expected amount (R$)",
    dayLabel: "Due day",
    save: "Save",
    cancel: "Cancel",
    markPaid: /I paid/,
    undo: /Undo/,
    del: "Delete",
    edit: "Edit",
    editTitle: "Edit bill",
    menu: (name: string) => `More actions: ${name}`,
    paid: "Paid",
    bank: "Paid from your bank",
    dueLine: /Due Jan 20/,
    addedDue: /Due Jan 31/,
    overdue: /Was due Jan 5/,
    groups: { overdue: "Overdue", due: "To pay", paid: "Paid" },
    summary: { paid: /R\$\s*159\.90 of R\$\s*2,170\.40 paid\./, toPay: /R\$\s*2,010\.50 left in 3 bills\./ },
    strip: { twoOnTwenty: /Day 20: 2 bills/, today: /Today is day 15/, mark: "today" },
    nameRequired: "Give the bill a name.",
    amountInvalid: "Enter an amount like 1,234.56.",
    dayInvalid: "Enter a day from 1 to 31.",
    amount: "1,234.56",
    shown: /R\$\s*1,234\.56/,
    empty: "A bill to pay is something due every month, like rent or electricity. Add the first one.",
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
          { id: "b5", name: "Condomínio", expectedCents: 30000, dueDay: 20, paid: {} },
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

    const row = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });
    const group = (page: Page, name: string) => page.getByRole("region", { name: new RegExp(`^${name}`) });
    const menuOf = (page: Page, name: string) => page.getByRole("button", { name: l.menu(name) });

    test("says paid of the total and what is left in one sentence, and each group heading counts its bills", async ({ page }) => {
      await expect(page.getByText(l.summary.paid)).toBeVisible();
      await expect(page.getByText(l.summary.toPay)).toBeVisible();
      await expect(group(page, l.groups.overdue).getByRole("heading")).toHaveText(`${l.groups.overdue} 1`);
      await expect(group(page, l.groups.due).getByRole("heading")).toHaveText(`${l.groups.due} 2`);
      await expect(group(page, l.groups.paid).getByRole("heading")).toHaveText(`${l.groups.paid} 2`);
    });

    test("the due-date strip marks today and counts two Bills on one day", async ({ page }) => {
      const strip = page.getByRole("img", { name: l.strip.twoOnTwenty });
      await expect(strip).toHaveAccessibleName(l.strip.today);
      await expect(strip.locator("text", { hasText: l.strip.mark })).toHaveCount(1);
      // A dot per Bill, filled for the two paid ones.
      await expect(strip.locator("circle")).toHaveCount(5);
      await expect(strip.locator("circle[data-paid]")).toHaveCount(2);
    });

    test("groups Bills as overdue, to pay and paid, and a bank-paid Bill says so and has no Undo", async ({ page }) => {
      await expect(group(page, l.groups.overdue).getByText("Aluguel")).toBeVisible();
      await expect(group(page, l.groups.due).getByText("Luz")).toBeVisible();
      await expect(group(page, l.groups.due).getByText("Condomínio")).toBeVisible();
      await expect(group(page, l.groups.paid).getByText("Água")).toBeVisible();
      await expect(row(page, "Internet").getByText(l.bank)).toBeVisible();
      await expect(row(page, "Internet").getByRole("button", { name: l.undo })).toHaveCount(0);
      await expect(row(page, "Água").getByText(l.paid, { exact: true })).toBeVisible();
      const aluguel = row(page, "Aluguel");
      await expect(aluguel.getByText(l.overdue)).toBeVisible();
      expect(await aluguel.innerText()).not.toContain("!");
    });

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
      const added = group(page, l.groups.due).getByRole("listitem").filter({ hasText: "Gás" });
      await expect(added.getByText(l.shown)).toBeVisible();
      await expect(added.getByText(l.addedDue)).toBeVisible();
    });

    test("marking a bill paid moves it to the paid group, and undoing moves it back", async ({ page, fakeApi }) => {
      await row(page, "Luz").getByRole("button", { name: l.markPaid }).click();
      const paid = group(page, l.groups.paid).getByRole("listitem").filter({ hasText: "Luz" });
      await expect(paid.getByText(l.paid, { exact: true })).toBeVisible();
      await expect(paid.getByRole("button", { name: l.markPaid })).toHaveCount(0);
      expect(fakeApi.requests.some((r) => r.method === "PUT" && r.path === "/me/finance/bills/b2/payments/2030-01")).toBe(true);

      await paid.getByRole("button", { name: l.undo }).click();
      await expect(group(page, l.groups.due).getByText("Luz")).toBeVisible();
      expect(fakeApi.requests.some((r) => r.method === "DELETE" && r.path === "/me/finance/bills/b2/payments/2030-01")).toBe(true);
    });

    test("the menu opens by keyboard, moves with the arrows, closes on Escape and gives focus back", async ({ page }) => {
      const trigger = menuOf(page, "Luz");
      await trigger.focus();
      await page.keyboard.press("Enter");
      const items = page.getByRole("menuitem");
      await expect(items).toHaveText([l.edit, l.del]);
      await expect(items.first()).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(items.last()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(items).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });

    test("editing a bill from the menu opens its form", async ({ page }) => {
      await menuOf(page, "Luz").click();
      await page.getByRole("menuitem", { name: l.edit }).click();
      const dialog = page.getByRole("dialog", { name: l.editTitle });
      await expect(dialog.getByLabel(l.nameLabel)).toHaveValue("Luz");
    });

    test("saving the edit form gives focus back to the bill's menu button", async ({ page }) => {
      const trigger = menuOf(page, "Luz");
      await trigger.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.getByRole("dialog", { name: l.editTitle }).getByRole("button", { name: l.save }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });

    // A pointer click, not the keyboard: the menu was still closing when the dialog opened, which froze the page.
    test("a dialog opened by click and cancelled leaves the page working, with focus back and no aria-hidden warning", async ({ page }) => {
      const logs: string[] = [];
      page.on("console", (m) => logs.push(m.text()));
      const trigger = menuOf(page, "Luz");
      await trigger.click();
      await page.getByRole("menuitem", { name: l.edit }).click();
      const dialog = page.getByRole("dialog", { name: l.editTitle });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: l.cancel }).click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => getComputedStyle(document.body).pointerEvents)).not.toBe("none");
      await row(page, "Condomínio").getByRole("button", { name: l.markPaid }).click();
      await expect(group(page, l.groups.paid).getByText("Condomínio")).toBeVisible();

      for (const confirm of [false, true]) {
        await menuOf(page, "Luz").click();
        await page.getByRole("menuitem", { name: l.del }).click();
        const ask = page.getByRole("dialog");
        await ask.getByRole("button", { name: confirm ? l.del : l.cancel }).click();
        await expect(ask).toHaveCount(0);
        await page.getByRole("button", { name: l.add }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.getByRole("dialog").getByRole("button", { name: l.cancel }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        if (!confirm) await expect(row(page, "Luz")).toHaveCount(1);
      }
      expect(logs.filter((m) => m.includes("aria-hidden"))).toEqual([]);
    });

    test("deleting a bill from the menu by keyboard asks first", async ({ page, fakeApi }) => {
      await menuOf(page, "Luz").focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      expect(fakeApi.requests.some((r) => r.method === "DELETE" && r.path === "/me/finance/bills/b2")).toBe(false);
      await dialog.getByRole("button", { name: l.del }).click();
      await expect(dialog).toHaveCount(0);
      await expect(row(page, "Luz")).toHaveCount(0);
      expect(fakeApi.requests.some((r) => r.method === "DELETE" && r.path === "/me/finance/bills/b2")).toBe(true);
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
