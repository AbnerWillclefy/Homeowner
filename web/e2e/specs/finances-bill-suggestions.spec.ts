import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, pt-BR first and then English, with the root font at 200%: Contas offers suggested Bills in a card
// above the groups, every value as text. "Adicionar" opens the Bill form prefilled and saving lists the Bill and removes
// the suggestion; "Dispensar" removes it at once and it stays gone after a reload; a dismissal that fails once brings
// the suggestion back with an error. The clock is fixed at 2030-01-15.

const LOCALES = [
  {
    locale: "pt-BR",
    heading: "Parece que se repete",
    question: "Quer adicionar como conta a pagar?",
    add: (name: string) => `Adicionar: ${name}`,
    dismiss: (name: string) => `Dispensar: ${name}`,
    day: "todo dia 12",
    amount: /R\$\s*39,90/,
    addTitle: "Nova conta",
    nameLabel: "Nome",
    amountLabel: "Valor esperado (R$)",
    dayLabel: "Dia do vencimento",
    save: "Salvar",
    failed: "Não conseguimos fazer isso. Tente de novo em instantes.",
    prefilled: "39,90",
  },
  {
    locale: "en-US",
    heading: "This seems to repeat",
    question: "Want to add it as a bill to pay?",
    add: (name: string) => `Add: ${name}`,
    dismiss: (name: string) => `Dismiss: ${name}`,
    day: "every month on day 12",
    amount: /R\$\s*39\.90/,
    addTitle: "New bill",
    nameLabel: "Name",
    amountLabel: "Expected amount (R$)",
    dayLabel: "Due day",
    save: "Save",
    failed: "We could not do that. Try again in a moment.",
    prefilled: "39.90",
  },
] as const;

const suggestions = [
  { merchantKey: "NETFLIX", name: "Netflix", amountCents: 3990, dueDay: 12 },
  { merchantKey: "SMART FIT", name: "Smart Fit", amountCents: 9990, dueDay: 5 },
];

const connected = () => {
  const s = signedInResident();
  s.user.finance = true;
  s.finance = { configured: false, sources: [], importing: false, lastSyncedAt: null, bills: [], billSuggestions: suggestions };
  return s;
};

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: connected() });

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await page.clock.setFixedTime(new Date("2030-01-15T12:00:00-03:00"));
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = "200%"));
      });
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/finances", baseURL!).toString());
    });

    const card = (page: import("@playwright/test").Page) => page.getByRole("region", { name: l.heading });

    test("offers each suggestion as text and nothing overflows sideways", async ({ page }) => {
      await expect(card(page).getByText(l.question)).toBeVisible();
      const netflix = card(page).getByRole("listitem").filter({ hasText: "Netflix" });
      await expect(netflix.getByText(l.amount)).toBeVisible();
      await expect(netflix.getByText(l.day)).toBeVisible();
      await expect(card(page).getByRole("listitem")).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

    test("adding opens the form prefilled; saving lists the Bill and removes the suggestion", async ({ page, fakeApi }) => {
      await card(page).getByRole("button", { name: l.add("Netflix") }).click();
      const dialog = page.getByRole("dialog", { name: l.addTitle });
      await expect(dialog.getByLabel(l.nameLabel)).toHaveValue("Netflix");
      await expect(dialog.getByLabel(l.amountLabel)).toHaveValue(l.prefilled);
      await expect(dialog.getByLabel(l.dayLabel)).toHaveValue("12");
      await dialog.getByRole("button", { name: l.save }).click();

      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("listitem").filter({ hasText: "Netflix" }).filter({ hasNotText: l.day })).toBeVisible();
      await expect(card(page).getByText("Netflix")).toHaveCount(0);
      await expect(card(page).getByText("Smart Fit")).toBeVisible();
      expect(fakeApi.requests.some((r) => r.method === "POST" && r.path === "/me/finance/bill-suggestions/dismissals")).toBe(true);
    });

    test("dismissing removes it at once and it stays gone after a reload", async ({ page }) => {
      await card(page).getByRole("button", { name: l.dismiss("Netflix") }).click();
      await expect(card(page).getByText("Netflix")).toHaveCount(0);
      await page.reload();
      await expect(card(page).getByText("Smart Fit")).toBeVisible();
      await expect(page.getByText("Netflix")).toHaveCount(0);
    });

    test("a dismissal that fails once brings the suggestion back with an error", async ({ page, fakeApi }) => {
      fakeApi.override("POST /me/finance/bill-suggestions/dismissals", { status: 500, body: { error: "boom" } }, { once: true });
      await card(page).getByRole("button", { name: l.dismiss("Netflix") }).click();
      await expect(card(page).getByText(l.failed)).toBeVisible();
      await expect(card(page).getByText("Netflix")).toBeVisible();

      await card(page).getByRole("button", { name: l.dismiss("Netflix") }).click();
      await expect(card(page).getByText("Netflix")).toHaveCount(0);
      await expect(card(page).getByText(l.failed)).toHaveCount(0);
    });
  });
}
