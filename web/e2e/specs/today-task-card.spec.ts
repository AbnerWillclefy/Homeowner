import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { tasksHandlers } from "../mocks/handlers/tasks";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers, in pt-BR and en-US: the Task card on Today shows its Category (as text), Chore, Effort and a
// one-line why with only the buttons that make sense now (Recusar and Aceitar on a Proposed Task, Concluir on a
// Committed one, Pegar on a pool Task), and "Aceitar todas" only with two or more Proposed. Tapping the card opens
// a Sheet with the whole story. Recusar and Concluir are shown at once and sent only when their toast closes
// (ADR 0029): Desfazer sends nothing, a tab change sends one, closing the toast sends one. Each of those would fail
// if the write were sent at tap time, because they read the fake API's request log before the toast closes.
// Sample Home: you hold "Wash the dishes" and "Mop the floors" (both Proposed); "Take out the trash" is in the pool.

const LOCALES = [
  {
    locale: "pt-BR",
    category: "Cozinha",
    effort: "Esforço: Leve",
    why: "Vence hoje.",
    refuse: (task: string) => `Recusar ${task}`,
    accept: (task: string) => `Aceitar ${task}`,
    done: (task: string) => `Concluir ${task}`,
    take: (task: string) => `Pegar ${task}`,
    more: (task: string) => `Mais ações, ${task}`,
    doneItem: "Concluir",
    acceptAll: "Aceitar todas as 2 tarefas",
    undo: "Desfazer",
    dismiss: "Dispensar mensagem",
    refused: "Tarefa recusada.",
    finished: "Tarefa concluída.",
    why_heading: "Por que hoje",
    demands: "Exigências: Abaixar-se",
    close: "Fechar",
    lar: "Lar",
    hoje: "Hoje",
    committed: "Assumida",
  },
  {
    locale: "en-US",
    category: "Kitchen",
    effort: "Effort: Light",
    why: "It is due today.",
    refuse: (task: string) => `Refuse ${task}`,
    accept: (task: string) => `Accept ${task}`,
    done: (task: string) => `Done with ${task}`,
    take: (task: string) => `Take ${task}`,
    more: (task: string) => `More actions, ${task}`,
    doneItem: "Done",
    acceptAll: "Accept all 2 Tasks",
    undo: "Undo",
    dismiss: "Dismiss message",
    refused: "Task refused.",
    finished: "Task done.",
    why_heading: "Why today",
    demands: "Demands: Bending",
    close: "Close",
    lar: "Home",
    hoje: "Today",
    committed: "Committed",
  },
] as const;

const DISHES = "Wash the dishes";
const MOP = "Mop the floors";
const TRASH = "Take out the trash";

const posts = (requests: { method: string; path: string }[], action: string) =>
  requests.filter((r) => r.method === "POST" && r.path.endsWith(`/${action}`));

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: signedInResident() });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      fakeApi.use(tasksHandlers);
      fakeApi.state.dayPlan!.mine[0]!.reason = "deadline_today";
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    const button = (page: Page, name: string) => page.getByRole("button", { name });
    const card = (page: Page, chore: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: chore }) });
    // Radix also writes the toast into a visually hidden live region, so only the one on screen counts.
    const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true });

    test("a Proposed card shows its Category, Chore, Effort and why, with Recusar then Aceitar", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const dishes = card(page, DISHES);
      await expect(dishes.getByText(l.category, { exact: true })).toBeVisible();
      await expect(dishes.getByText(l.effort, { exact: true })).toBeAttached();
      await expect(dishes.getByText(l.why, { exact: true })).toBeVisible();
      const buttons = dishes.getByRole("button");
      await expect(buttons.nth(1)).toHaveAccessibleName(l.refuse(DISHES));
      await expect(buttons.nth(2)).toHaveAccessibleName(l.accept(DISHES));
      await expect(dishes.getByText(l.committed, { exact: true })).toHaveCount(0);
      // No button is Concluir on a Proposed Task, and Swap is not on your own Task.
      await expect(button(page, l.done(DISHES))).toHaveCount(0);
      await expect(dishes.getByRole("button", { name: l.more(DISHES) })).toHaveCount(0);
    });

    test("Aceitar todas shows with two Proposed Tasks and goes with one", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await expect(button(page, l.acceptAll)).toBeVisible();
      await button(page, l.accept(DISHES)).click();
      // Accepting sends at once (nothing to undo); with one Proposed Task left it has its own Aceitar.
      await expect(card(page, DISHES).getByText(l.committed, { exact: true })).toBeVisible();
      await expect(button(page, l.acceptAll)).toHaveCount(0);
      await expect(button(page, l.accept(MOP))).toBeVisible();
      expect(posts(fakeApi.requests, "accept")).toHaveLength(1);
    });

    test("a Committed card has Concluir alone, and a pool card Pegar with Concluir in its menu", async ({ page, baseURL, fakeApi }) => {
      fakeApi.state.dayPlan!.mine[0]!.committed = true;
      await launchApp(page, baseURL!);
      const dishes = card(page, DISHES);
      await expect(dishes.getByRole("button", { name: l.done(DISHES) })).toBeVisible();
      await expect(dishes.getByRole("button", { name: l.refuse(DISHES) })).toHaveCount(0);
      await expect(dishes.getByText(l.committed, { exact: true })).toBeVisible();

      const pool = card(page, TRASH).last();
      await expect(pool.getByRole("button", { name: l.take(TRASH) })).toBeVisible();
      await expect(pool.getByRole("button", { name: l.done(TRASH) })).toHaveCount(0);
      await pool.getByRole("button", { name: l.more(TRASH) }).click();
      await expect(page.getByRole("dialog", { name: l.more(TRASH) }).getByRole("button", { name: l.doneItem, exact: true })).toBeVisible();
    });

    test("tapping the card opens a Sheet with the why and the facts, and focus returns to the card", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const opener = page.getByRole("button", { name: MOP, exact: true });
      await opener.click();
      const sheet = page.getByRole("dialog", { name: MOP });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole("heading", { name: l.why_heading })).toBeVisible();
      await expect(sheet.getByText(l.demands)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await expect(opener).toBeFocused();
    });

    test("Recusar shows at once and Desfazer sends nothing", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await button(page, l.refuse(DISHES)).click();
      await expect(button(page, l.accept(DISHES))).toHaveCount(0);
      await expect(button(page, l.take(DISHES))).toBeVisible();
      await expect(toast(page, l.refused)).toBeVisible();
      expect(posts(fakeApi.requests, "refuse")).toHaveLength(0);
      await button(page, l.undo).click();
      await expect(button(page, l.accept(DISHES))).toBeVisible();
      await expect(button(page, l.take(DISHES))).toHaveCount(0);
      // Give a wrongly sent write time to arrive.
      await page.waitForTimeout(300);
      expect(posts(fakeApi.requests, "refuse")).toHaveLength(0);
    });

    test("Recusar then switching tab sends one request", async ({ page, baseURL, fakeApi }) => {
      await launchApp(page, baseURL!);
      await button(page, l.refuse(DISHES)).click();
      await expect(toast(page, l.refused)).toBeVisible();
      expect(posts(fakeApi.requests, "refuse")).toHaveLength(0);
      await page.getByRole("navigation").getByRole("link", { name: l.lar, exact: true }).click();
      await expect.poll(() => posts(fakeApi.requests, "refuse").length).toBe(1);
      await page.getByRole("navigation").getByRole("link", { name: l.hoje, exact: true }).click();
      await expect(button(page, l.take(DISHES))).toBeVisible();
      expect(posts(fakeApi.requests, "refuse")).toHaveLength(1);
    });

    test("Concluir then closing the toast sends one request, and a second Concluir sends the first", async ({ page, baseURL, fakeApi }) => {
      fakeApi.state.dayPlan!.mine.forEach((task) => (task.committed = true));
      await launchApp(page, baseURL!);
      await button(page, l.done(DISHES)).click();
      await expect(button(page, l.done(DISHES))).toHaveCount(0);
      await expect(toast(page, l.finished)).toBeVisible();
      expect(posts(fakeApi.requests, "complete")).toHaveLength(0);
      // The other card stays usable while one write is held; pressing it sends the first.
      await button(page, l.done(MOP)).click();
      await expect.poll(() => posts(fakeApi.requests, "complete").map((r) => r.path)).toEqual(["/home/tasks/task-1/complete"]);
      await page.getByRole("button", { name: l.dismiss }).click();
      await expect.poll(() => posts(fakeApi.requests, "complete")).toHaveLength(2);
    });

    test("closing the Concluir toast sends it once", async ({ page, baseURL, fakeApi }) => {
      fakeApi.state.dayPlan!.mine[0]!.committed = true;
      await launchApp(page, baseURL!);
      await button(page, l.done(DISHES)).click();
      await expect(toast(page, l.finished)).toBeVisible();
      expect(posts(fakeApi.requests, "complete")).toHaveLength(0);
      await page.getByRole("button", { name: l.dismiss }).click();
      await expect.poll(() => posts(fakeApi.requests, "complete")).toHaveLength(1);
      await page.waitForTimeout(300);
      expect(posts(fakeApi.requests, "complete")).toHaveLength(1);
    });
  });
}
