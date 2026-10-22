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
// Offering: Swap is on Bruna's one-person Task only when it can work, the dialog opens on a tap, lists what you
// can give and sends one request, a server refusal is a calm status, and focus never lands on nothing.
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
    swap: "Trocar",
    title: "O que você vai dar?",
    submit: "Oferecer troca",
    dismiss: "Cancelar",
    restricted: "Essa troca não combina com as restrições de hoje.",
    required: "Escolha uma tarefa para dar.",
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
    swap: "Swap",
    title: "What will you give?",
    submit: "Offer swap",
    dismiss: "Cancel",
    restricted: "This Swap does not fit today's Restrictions.",
    required: "Pick a Task to give.",
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
      const planReads = () => fakeApi.requests.filter((r) => r.method === "GET" && r.path === "/home/day-plan").length;
      await expect(page.getByRole("button", { name: new RegExp(`^${l.accept}`) })).toBeVisible();
      const readsBefore = planReads();
      await page.getByRole("button", { name: new RegExp(`^${l.accept}`) }).click();
      await expect(page.getByRole("heading", { level: 3, name: l.incoming })).toHaveCount(0);
      // The server's answer is written into the cache: the action sends no read of the plan.
      expect(planReads()).toBe(readsBefore);

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
      const planReads = () => fakeApi.requests.filter((r) => r.method === "GET" && r.path === "/home/day-plan").length;
      await expect(page.getByRole("button", { name: new RegExp(`^${l.accept}`) })).toBeVisible();
      const readsBefore = planReads();
      await page.getByRole("button", { name: new RegExp(`^${l.accept}`) }).click();
      await expect(page.getByRole("status").filter({ hasText: l.stale })).toBeVisible();
      // A 409 reads the plan once, to show the fresh one.
      expect(planReads()).toBe(readsBefore + 1);
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

    // Offering a Swap: you start from the Task you want (Bruna's `task-3`), then pick what you give.
    const swapButton = (page: import("@playwright/test").Page) =>
      page.getByRole("button", { name: new RegExp(`^${l.swap} Take out the trash`) });
    const brunaCard = (page: import("@playwright/test").Page) =>
      page
        .locator('section[aria-labelledby^="resident-"]')
        .filter({ has: page.getByRole("heading", { level: 4, name: "Bruna Souza" }) })
        .getByRole("listitem")
        .filter({ hasText: "Take out the trash" });
    const pick = (page: import("@playwright/test").Page, chore: string) =>
      page.getByRole("dialog").locator("label").filter({ hasText: chore }).click();
    const swapRequests = (requests: { method: string; path: string; body: unknown }[]) =>
      requests.filter((r) => r.method === "POST" && r.path === "/home/swaps");

    test("Swap is only on another Resident's one-person Task, and the dialog does not open by itself", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(swapButton(page)).toHaveCount(1);
      await expect(brunaCard(page).getByRole("button", { name: l.swap })).toBeVisible();
      // Not on your own Tasks, nor in the pool.
      await expect(group(page, l.mine).getByRole("button", { name: new RegExp(`^${l.swap}`) })).toHaveCount(0);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("offering opens a dialog of your one-person Tasks, sends the offer, and moves the offer under Your offers", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await swapButton(page).click();
      const dialog = page.getByRole("dialog", { name: l.title });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Bruna Souza")).toBeVisible();
      await expect(dialog.getByRole("radio")).toHaveCount(2);
      await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(0);
      expect(swapRequests(fakeApi.requests)).toHaveLength(0);

      await pick(page, "Mop the floors");
      await dialog.getByRole("button", { name: l.submit }).click();
      await expect(dialog).toHaveCount(0);

      expect(swapRequests(fakeApi.requests).map((r) => r.body)).toEqual([
        { offeredTaskId: "task-2", requestedTaskId: "task-3" },
      ]);
      const offers = group(page, l.outgoing);
      await expect(offers).toBeVisible();
      await expect(offers.getByText("Mop the floors")).toBeVisible();
      await expect(offers.getByText("Take out the trash", { exact: true })).toBeVisible();
      await expect(swapButton(page)).toHaveCount(0);
      await noAlertText(page);
      // The Swap button is gone, so focus lands inside the page, never on nothing.
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);

      // Cancel the offer: Swap is back on the Task.
      await offers.getByRole("button", { name: new RegExp(`^${l.cancel}`) }).click();
      await expect(page.getByRole("heading", { level: 3, name: l.outgoing })).toHaveCount(0);
      await expect(swapButton(page)).toBeVisible();
    });

    test("Cancel closes the dialog with no call and focus returns to the Swap button", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await swapButton(page).click();
      await page.getByRole("dialog").getByRole("button", { name: l.dismiss }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(swapRequests(fakeApi.requests)).toHaveLength(0);
      await expect(swapButton(page)).toBeFocused();
    });

    test("submitting with nothing picked asks for a Task and sends nothing", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await swapButton(page).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: l.submit }).click();
      await expect(dialog.getByRole("alert").filter({ hasText: l.required })).toBeVisible();
      expect(swapRequests(fakeApi.requests)).toHaveLength(0);
    });

    test("a single Task of yours is preselected", async ({ page, baseURL, fakeApi }) => {
      fakeApi.state.dayPlan!.mine = [fakeApi.state.dayPlan!.mine[0]!];
      await launchApp(page, baseURL!);
      await swapButton(page).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("radio")).toHaveCount(1);
      await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(1);
      await dialog.getByRole("button", { name: l.submit }).click();
      await expect(dialog).toHaveCount(0);
      expect(swapRequests(fakeApi.requests).map((r) => r.body)).toEqual([
        { offeredTaskId: "task-1", requestedTaskId: "task-3" },
      ]);
    });

    test("a refusal closes the dialog and says so calmly, with no alert", async ({ page, baseURL, fakeApi }) => {
      fakeApi.override("POST /home/swaps", json(409, { error: "restricted" }), { once: true });
      await launchApp(page, baseURL!);
      await swapButton(page).click();
      await pick(page, "Mop the floors");
      await page.getByRole("dialog").getByRole("button", { name: l.submit }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: l.restricted })).toBeVisible();
      await noAlertText(page);
      await expect(page.getByRole("heading", { level: 3, name: l.outgoing })).toHaveCount(0);
      await expect(swapButton(page)).toBeVisible();
    });

    test("Swap is absent on a two-person Task, before the day is planned, after a rejected run, with nothing to give, and when already offered", async ({ page, baseURL, fakeApi }) => {
      const plan = fakeApi.state.dayPlan!;
      // Two-person: Bruna's only Task needs two people.
      plan.others[0]!.tasks[0]!.people = 2;
      await launchApp(page, baseURL!);
      await expect(brunaCard(page)).toBeVisible();
      await expect(swapButton(page)).toHaveCount(0);

      // Not planned yet.
      plan.others[0]!.tasks[0]!.people = 1;
      plan.planned = false;
      await page.reload();
      await expect(swapButton(page)).toHaveCount(0);

      // A rejected run.
      plan.planned = true;
      plan.rejected = true;
      await page.reload();
      await expect(brunaCard(page)).toBeVisible();
      await expect(swapButton(page)).toHaveCount(0);

      // Nothing of yours that can be given: only a two-person Task.
      plan.rejected = false;
      plan.mine = plan.mine.map((task) => ({ ...task, people: 2 }));
      await page.reload();
      await expect(brunaCard(page)).toBeVisible();
      await expect(swapButton(page)).toHaveCount(0);

      // Already offered for.
      plan.mine = plan.mine.map((task) => ({ ...task, people: 1 }));
      withOutgoingOffer(fakeApi.state);
      await page.reload();
      await expect(brunaCard(page)).toBeVisible();
      await expect(swapButton(page)).toHaveCount(0);
      await noAlertText(page);
    });

    test("long names wrap in the card and the dialog, which stacks its buttons at large text", async ({ page, baseURL, fakeApi }) => {
      const state = fakeApi.state;
      state.residents![1]!.name = LONG_NAME;
      state.dayPlan!.mine[0]!.choreName = LONG_CHORE;
      state.dayPlan!.mine[1]!.choreName = `${LONG_CHORE} and the cupboards`;
      state.dayPlan!.others[0]!.tasks[0]!.choreName = LONG_CHORE;
      await page.setViewportSize({ width: 320, height: 800 });
      await launchApp(page, baseURL!);
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      const button = page.getByRole("button", { name: new RegExp(`^${l.swap} `) });
      await button.scrollIntoViewIfNeeded();
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await button.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(LONG_NAME)).toBeVisible();
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      const dismiss = (await dialog.getByRole("button", { name: l.dismiss }).boundingBox())!;
      const submit = (await dialog.getByRole("button", { name: l.submit }).boundingBox())!;
      // Stacked: the primary is below Cancel, and both fit the width.
      expect(submit.y).toBeGreaterThan(dismiss.y);
      expect(submit.x + submit.width).toBeLessThanOrEqual(320);
      expect(dismiss.height).toBeGreaterThanOrEqual(44);
      expect(submit.height).toBeGreaterThanOrEqual(44);
    });
  });
}
