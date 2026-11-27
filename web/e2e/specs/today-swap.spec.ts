import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { swapsHandlers } from "../mocks/handlers/swaps";
import { RESIDENT_EMAIL, signedInResident, withIncomingOffer, withOutgoingOffer } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers: the Swap offers on Today, in pt-BR. An incoming offer is accepted (the Tasks
// change hands and both read "swapped") or declined (nothing is said, no alert), an outgoing one is cancelled, a
// stale offer reloads the plan in place with a calm status line, and long names wrap instead of overflowing.
// Offering: "Oferecer troca" is in the ⋯ menu of your own one-person Task's Sheet only when it can work; it closes that
// Sheet and opens the Swap Sheet, which lists what you can ask for and sends one request; a server refusal is a calm
// status, and focus never lands on nothing.
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
    more: "Mais ações, ",
    swapItem: "Oferecer troca",
    edit: "Editar o afazer",
    sheetTitle: "Oferecer troca",
    subtitle: "A troca só acontece se a Bruna Souza aceitar.",
    group: "Tarefas para pedir",
    choiceHint: "Lixo · Muito leve · assumida pela Bruna Souza",
    send: "Enviar oferta",
    close: "Fechar",
    restricted: "Essa troca não combina com as restrições de hoje.",
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

    /** The block under a group heading: the parent of the heading's row. */
    const group = (page: import("@playwright/test").Page, name: string) =>
      page.getByRole("heading", { level: 2, name }).locator("../..");
    /** Your own Task cards: the list in the "Your Tasks" block. Its heading sits in a row with "Aceitar todas" only while 2+ are Proposed. */
    const mineCards = (page: import("@playwright/test").Page) =>
      page.locator("div:has(> div > h2)").filter({ has: page.getByRole("heading", { level: 2, name: l.mine }) }).locator("> ul");
    const noAlertText =(page: import("@playwright/test").Page) =>
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
      // The offers come after the title and the summary, and before your own Task cards.
      const above = await page.evaluate(
        ([incoming, mine]) => {
          const heading = (text: string) => [...document.querySelectorAll("h2")].find((h) => h.textContent?.startsWith(text))!;
          return !!(heading(incoming!).compareDocumentPosition(heading(mine!)) & Node.DOCUMENT_POSITION_FOLLOWING);
        },
        [l.incoming, l.mine],
      );
      expect(above).toBe(true);
      await expect(page.getByRole("heading", { level: 2, name: l.outgoing })).toHaveCount(0);
    });

    test("accepting moves both Tasks and both read swapped", async ({ page, baseURL, fakeApi }) => {
      withIncomingOffer(fakeApi.state);
      await launchApp(page, baseURL!);
      const planReads = () => fakeApi.requests.filter((r) => r.method === "GET" && r.path === "/home/day-plan").length;
      await expect(page.getByRole("button", { name: new RegExp(`^${l.accept}`) })).toBeVisible();
      const readsBefore = planReads();
      await page.getByRole("button", { name: new RegExp(`^${l.accept}`) }).click();
      await expect(page.getByRole("heading", { level: 2, name: l.incoming })).toHaveCount(0);
      // The server's answer is written into the cache: the action sends no read of the plan.
      expect(planReads()).toBe(readsBefore);

      const received = mineCards(page).getByRole("listitem").filter({ hasText: "Take out the trash" });
      await expect(received).toBeVisible();
      await expect(received.getByText(l.committed, { exact: true })).toBeVisible();
      await expect(received.getByText(l.swapped)).toBeVisible();
      await expect(mineCards(page).getByText("Wash the dishes")).toHaveCount(0);

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
      await expect(page.getByRole("heading", { level: 2, name: l.incoming })).toHaveCount(0);
      await expect(mineCards(page).getByText("Wash the dishes")).toBeVisible();
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
      await expect(page.getByRole("heading", { level: 2, name: l.outgoing })).toHaveCount(0);
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
      await expect(page.getByRole("heading", { level: 2, name: l.incoming })).toHaveCount(0);
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
      await expect(page.getByRole("heading", { level: 2, name: l.outgoing })).toHaveCount(0);
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

    // Offering a Swap: you start from your own Task (`task-1`, "Wash the dishes"). Its Sheet's ⋯ menu holds "Oferecer troca",
    // which closes the Task's Sheet and opens the Swap one, where you pick what to ask for (Bruna's `task-3`).
    type Page = import("@playwright/test").Page;
    const openTask = async (page: Page, chore: string) => page.getByRole("button", { name: chore, exact: true }).first().click();
    const openMenu = async (page: Page, chore: string) => {
      await openTask(page, chore);
      await page.getByRole("dialog", { name: chore }).getByRole("button", { name: `${l.more}${chore}` }).click();
    };
    const swapItem = (page: Page) => page.getByRole("dialog", { name: new RegExp(`^${l.more}`) }).getByRole("button", { name: l.swapItem, exact: true });
    const openSwap = async (page: Page, chore = "Wash the dishes") => {
      await openMenu(page, chore);
      await swapItem(page).click();
    };
    const sheet = (page: Page) => page.getByRole("dialog", { name: l.sheetTitle });
    const swapRequests = (requests: { method: string; path: string; body: unknown }[]) =>
      requests.filter((r) => r.method === "POST" && r.path === "/home/swaps");

    test("Oferecer troca is only in the menu of your own one-person Task's Sheet, and the Swap Sheet does not open by itself", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // Not a button on any card.
      await expect(page.getByRole("button", { name: l.swapItem, exact: true })).toHaveCount(0);
      await openMenu(page, "Wash the dishes");
      await expect(swapItem(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");

      // Another Resident's Task and the pool's: the menu has the edit link, and no Swap.
      for (const [index, chore] of [[0, "Take out the trash"], [1, "Take out the trash"]] as const) {
        await page.getByRole("button", { name: chore, exact: true }).nth(index).click();
        await page.getByRole("dialog", { name: chore }).getByRole("button", { name: `${l.more}${chore}` }).click();
        await expect(page.getByRole("dialog", { name: new RegExp(`^${l.more}`) }).getByRole("button", { name: l.edit, exact: true })).toBeVisible();
        await expect(swapItem(page)).toHaveCount(0);
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
      }
    });

    test("offering replaces the Task's Sheet with the Swap Sheet, sends the offer, and moves the offer under Your offers", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await openSwap(page);
      await expect(sheet(page)).toBeVisible();
      // Not stacked: the Task's Sheet is gone.
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(sheet(page)).toHaveAccessibleDescription(l.subtitle);
      await expect(sheet(page).getByText("Wash the dishes", { exact: true })).toBeVisible();
      const choices = sheet(page).getByRole("radiogroup", { name: l.group }).getByRole("radio");
      await expect(choices).toHaveCount(1);
      await expect(choices.first()).toHaveAccessibleName(/^Take out the trash/);
      await expect(sheet(page).getByText(l.choiceHint, { exact: true })).toBeVisible();
      await expect(sheet(page).getByRole("radio", { checked: true })).toHaveCount(0);
      await expect(sheet(page).getByRole("button", { name: l.send })).toBeDisabled();
      expect(swapRequests(fakeApi.requests)).toHaveLength(0);

      await sheet(page).getByText("Take out the trash").click();
      await sheet(page).getByRole("button", { name: l.send }).click();
      await expect(sheet(page)).toHaveCount(0);

      expect(swapRequests(fakeApi.requests).map((r) => r.body)).toEqual([{ offeredTaskId: "task-1", requestedTaskId: "task-3" }]);
      const offers = group(page, l.outgoing);
      await expect(offers).toBeVisible();
      await expect(offers.getByText("Wash the dishes", { exact: true })).toBeVisible();
      await expect(offers.getByText("Take out the trash", { exact: true })).toBeVisible();
      await noAlertText(page);
      // Never on nothing or on <main>: the card's open button or the Today heading.
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.id === "today-heading" || document.activeElement?.textContent === "Wash the dishes"))
        .toBe(true);

      // The offered Task has no Swap now; cancelling the offer brings it back.
      await openMenu(page, "Wash the dishes");
      await expect(swapItem(page)).toHaveCount(0);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await offers.getByRole("button", { name: new RegExp(`^${l.cancel}`) }).click();
      await expect(page.getByRole("heading", { level: 2, name: l.outgoing })).toHaveCount(0);
      await openMenu(page, "Wash the dishes");
      await expect(swapItem(page)).toBeVisible();
    });

    test("closing the Swap Sheet sends nothing and focus returns to the Task's open button", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await openSwap(page);
      await sheet(page).getByRole("button", { name: l.close, exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(swapRequests(fakeApi.requests)).toHaveLength(0);
      await expect(page.getByRole("button", { name: "Wash the dishes", exact: true })).toBeFocused();
    });

    test("Enviar oferta stays off until a Task is picked", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await openSwap(page);
      const send = sheet(page).getByRole("button", { name: l.send });
      await expect(send).toBeDisabled();
      await sheet(page).getByText("Take out the trash").click();
      await expect(send).toBeEnabled();
      expect(swapRequests(fakeApi.requests)).toHaveLength(0);
    });

    test("a refusal closes the Sheet and says so calmly, with no alert", async ({ page, baseURL, fakeApi }) => {
      fakeApi.override("POST /home/swaps", json(409, { error: "restricted" }), { once: true });
      await launchApp(page, baseURL!);
      await openSwap(page);
      await sheet(page).getByText("Take out the trash").click();
      await sheet(page).getByRole("button", { name: l.send }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: l.restricted })).toBeVisible();
      await noAlertText(page);
      await expect(page.getByRole("heading", { level: 2, name: l.outgoing })).toHaveCount(0);
    });

    test("Oferecer troca is absent when nothing can be asked for, on a two-person Task of yours, and when already offered", async ({ page, baseURL, fakeApi }) => {
      const plan = fakeApi.state.dayPlan!;
      const expectNoSwap = async () => {
        await openMenu(page, "Wash the dishes");
        // The menu is open: it has its other item, and no Swap.
        await expect(page.getByRole("dialog", { name: new RegExp(`^${l.more}`) }).getByRole("button", { name: l.edit, exact: true })).toBeVisible();
        await expect(swapItem(page)).toHaveCount(0);
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
      };

      // Two-person: Bruna's only Task needs two people, so there is nothing to ask for.
      plan.others[0]!.tasks[0]!.people = 2;
      await launchApp(page, baseURL!);
      await expectNoSwap();

      // A rejected run.
      plan.others[0]!.tasks[0]!.people = 1;
      plan.rejected = true;
      await page.reload();
      await expectNoSwap();

      // Your own Task needs two people.
      plan.rejected = false;
      plan.mine = plan.mine.map((task) => ({ ...task, people: 2 }));
      await page.reload();
      await expectNoSwap();

      // Bruna's Task is already asked for.
      plan.mine = plan.mine.map((task) => ({ ...task, people: 1 }));
      withOutgoingOffer(fakeApi.state);
      await page.reload();
      await expectNoSwap();
      await noAlertText(page);
    });

    test("long names wrap in the Swap Sheet, which keeps Enviar oferta reachable at large text", async ({ page, baseURL, fakeApi }) => {
      const state = fakeApi.state;
      state.residents![1]!.name = LONG_NAME;
      state.dayPlan!.mine[0]!.choreName = LONG_CHORE;
      state.dayPlan!.others[0]!.tasks[0]!.choreName = `${LONG_CHORE} and the cupboards`;
      await page.setViewportSize({ width: 320, height: 800 });
      await launchApp(page, baseURL!);
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await openSwap(page, LONG_CHORE);
      await expect(sheet(page).getByText(LONG_NAME).first()).toBeVisible();
      const box = (await sheet(page).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      const send = (await sheet(page).getByRole("button", { name: l.send }).boundingBox())!;
      expect(send.x + send.width).toBeLessThanOrEqual(320);
      expect(send.height).toBeGreaterThanOrEqual(44);
    });
  });
}
