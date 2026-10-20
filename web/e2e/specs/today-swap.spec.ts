import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { swapsHandlers } from "../mocks/handlers/swaps";
import { RESIDENT_EMAIL, signedInResident, withIncomingOffer, withOutgoingOffer } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers: the Swap offers on Today, in pt-BR and then en-US. An incoming offer is accepted (the Tasks
// change hands and both read "swapped") or declined (nothing is said, no alert), an outgoing one is cancelled, a
// stale offer reloads the plan in place with a calm status line, and long names wrap instead of overflowing.
// Sample Home: Bruna Souza holds "Take out the trash" and offers it for your "Wash the dishes" (swap-in-1); you
// offer "Mop the floors" for her "Take out the trash" (swap-out-1).

const LONG_NAME = "Abcdefghijklmnopqrstuvwxyzabcdefghijklmn"; // 40 characters, no break opportunity
const LONG_CHORE = "Deep clean the oven hood and its filters, then wipe the whole kitchen down";

const LOCALES = [
  {
    locale: "pt-BR",
    incoming: "Trocas para você",
    outgoing: "Suas ofertas de troca",
    mine: "Suas tarefas",
    accept: "Aceitar troca",
    decline: "Recusar troca",
    cancel: "Cancelar troca",
    committed: "Assumida",
    swapped: "Veio de uma troca.",
    stale: "As tarefas mudaram, então essa troca não vale mais. Sua lista está atualizada.",
    hint: /conta para sua sequência/,
  },
  {
    locale: "en-US",
    incoming: "Offers to you",
    outgoing: "Your offers",
    mine: "Your Tasks",
    accept: "Accept swap",
    decline: "Decline swap",
    cancel: "Cancel swap",
    committed: "Committed",
    swapped: "It came from a Swap.",
    stale: "The Tasks changed, so that Swap no longer applies. Your list is up to date.",
    hint: /counts towards your Streak/,
  },
] as const;

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: signedInResident() });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      fakeApi.use(swapsHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    /** The block under a group heading: the heading's parent. */
    const group = (page: import("@playwright/test").Page, name: string) =>
      page.getByRole("heading", { level: 3, name }).locator("..");
    const noAlertText = (page: import("@playwright/test").Page) =>
      expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);

    test("an incoming offer shows who gives what, Decline first and Accept last, above Your Tasks", async ({ page, baseURL, fakeApi }) => {
      withIncomingOffer(fakeApi.state);
      await launchApp(page, baseURL!);
      const offers = group(page, l.incoming);
      await expect(offers).toBeVisible();
      await expect(offers.getByText("Bruna Souza")).toBeVisible();
      await expect(offers.getByText("Take out the trash")).toBeVisible();
      await expect(offers.getByText("Wash the dishes")).toBeVisible();
      const buttons = offers.getByRole("button");
      await expect(buttons).toHaveCount(2);
      await expect(buttons.first()).toHaveAccessibleName(new RegExp(`^${l.decline}`));
      await expect(buttons.last()).toHaveAccessibleName(new RegExp(`^${l.accept}`));
      const above = await page.evaluate(
        ([a, b]) => {
          const heading = (text: string) => [...document.querySelectorAll("h3")].find((h) => h.textContent?.startsWith(text))!;
          return !!(heading(a!).compareDocumentPosition(heading(b!)) & Node.DOCUMENT_POSITION_FOLLOWING);
        },
        [l.incoming, l.mine],
      );
      expect(above).toBe(true);
      await expect(page.getByRole("heading", { level: 3, name: l.outgoing })).toHaveCount(0);
    });

    test("accepting moves both Tasks and both read swapped", async ({ page, baseURL, fakeApi }) => {
      withIncomingOffer(fakeApi.state);
      await launchApp(page, baseURL!);
      await page.getByRole("button", { name: new RegExp(`^${l.accept}`) }).click();
      await expect(page.getByRole("heading", { level: 3, name: l.incoming })).toHaveCount(0);

      const received = group(page, l.mine).getByRole("listitem").filter({ hasText: "Take out the trash" });
      await expect(received).toBeVisible();
      await expect(received.getByText(l.committed, { exact: true })).toBeVisible();
      await expect(received.getByText(l.swapped)).toBeVisible();
      await expect(group(page, l.mine).getByText("Wash the dishes")).toHaveCount(0);

      const bruna = page.locator("section").filter({ has: page.getByRole("heading", { level: 4, name: "Bruna Souza" }) });
      const given = bruna.getByRole("listitem").filter({ hasText: "Wash the dishes" });
      await expect(given).toBeVisible();
      await expect(given.getByText(l.swapped)).toBeVisible();
      await noAlertText(page);
    });

    test("declining removes the offer with no alert and no status", async ({ page, baseURL, fakeApi }) => {
      withIncomingOffer(fakeApi.state);
      await launchApp(page, baseURL!);
      await page.getByRole("button", { name: new RegExp(`^${l.decline}`) }).click();
      await expect(page.getByRole("heading", { level: 3, name: l.incoming })).toHaveCount(0);
      await expect(group(page, l.mine).getByText("Wash the dishes")).toBeVisible();
      await noAlertText(page);
      await expect(page.getByRole("status").filter({ hasText: /\S/ })).toHaveCount(0);
    });

    test("an outgoing offer names both Tasks, the Streak hint and a lone Cancel; cancelling removes it", async ({ page, baseURL, fakeApi }) => {
      withOutgoingOffer(fakeApi.state);
      await launchApp(page, baseURL!);
      const offers = group(page, l.outgoing);
      await expect(offers).toBeVisible();
      await expect(offers.getByText("Bruna Souza")).toBeVisible();
      await expect(offers.getByText("Mop the floors")).toBeVisible();
      await expect(offers.getByText(l.hint)).toBeVisible();
      await expect(offers.getByRole("button")).toHaveCount(1);
      await offers.getByRole("button", { name: new RegExp(`^${l.cancel}`) }).click();
      await expect(page.getByRole("heading", { level: 3, name: l.outgoing })).toHaveCount(0);
      await noAlertText(page);
    });

    test("a stale offer reloads the plan in place and says so calmly", async ({ page, baseURL, fakeApi }) => {
      withIncomingOffer(fakeApi.state);
      fakeApi.override(
        "POST /home/swaps/{id}/accept",
        (_, state) => {
          state.dayPlan!.swaps.incoming = [];
          return json(409, { error: "swap_stale" });
        },
        { once: true },
      );
      await launchApp(page, baseURL!);
      await page.getByRole("button", { name: new RegExp(`^${l.accept}`) }).click();
      await expect(page.getByRole("status").filter({ hasText: l.stale })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3, name: l.incoming })).toHaveCount(0);
      await noAlertText(page);
    });

    test("a 404 swap_not_found is a stale screen too", async ({ page, baseURL, fakeApi }) => {
      withOutgoingOffer(fakeApi.state);
      fakeApi.override(
        "POST /home/swaps/{id}/cancel",
        (_, state) => {
          state.dayPlan!.swaps.outgoing = [];
          return json(404, { error: "swap_not_found" });
        },
        { once: true },
      );
      await launchApp(page, baseURL!);
      await page.getByRole("button", { name: new RegExp(`^${l.cancel}`) }).click();
      await expect(page.getByRole("status").filter({ hasText: /\S/ })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3, name: l.outgoing })).toHaveCount(0);
      await noAlertText(page);
    });

    test("a long name and long Chore names wrap instead of overflowing", async ({ page, baseURL, fakeApi }) => {
      const state = withOutgoingOffer(withIncomingOffer(fakeApi.state));
      state.residents![1]!.name = LONG_NAME;
      const plan = state.dayPlan!;
      for (const offer of [...plan.swaps.incoming, ...plan.swaps.outgoing]) {
        offer.offered.choreName = LONG_CHORE;
        offer.requested.choreName = `${LONG_CHORE} and the cupboards`;
      }
      await page.setViewportSize({ width: 320, height: 800 });
      await launchApp(page, baseURL!);
      await expect(group(page, l.incoming).getByText(LONG_NAME)).toBeVisible();
      await expect(group(page, l.outgoing).getByText(LONG_NAME)).toBeVisible();
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflows).toBe(false);
      for (const button of await page.getByRole("button", { name: new RegExp(`^(${l.accept}|${l.decline}|${l.cancel})`) }).all()) {
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
      }
    });
  });
}
