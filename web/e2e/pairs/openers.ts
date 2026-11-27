import type { Page } from "@playwright/test";
import { ptBR } from "../../src/shared/i18n/catalogs/pt-BR";
import type { State } from "./screens";

// Each opener takes the loaded screen to its state, by role and by the pt-BR catalog's own words, so a reworded
// button follows the catalog. No `expect` here: screens.test.ts imports this file under Vitest, not Playwright.

const dialog = (page: Page) => page.getByRole("dialog");
const button = (page: Page, name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });

/** Runs in the page. Resolves once the open dialog's box is the same on three frames in a row and its finite animations are over. */
async function settle(): Promise<void> {
  const selector = "[data-slot=sheet], [data-slot=dialog], [role=dialog]";
  const open = () => [...document.querySelectorAll(selector)].filter((el) => el.getClientRects().length > 0).at(-1);
  const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const key = (el: Element | undefined) => {
    const r = el?.getBoundingClientRect();
    return r ? `${r.x},${r.y},${r.width},${r.height}` : "";
  };
  // performance.now(), not Date.now(): the pairs clock is fixed with page.clock, which freezes Date.now().
  const start = performance.now();
  let last = "";
  let equal = 0;
  while (equal < 2) {
    if (performance.now() - start > 5000) throw new Error("the dialog did not stop moving in 5s");
    await frame();
    const el = open();
    // A spinner repeats forever, so only animations with an end count.
    const running = (el?.getAnimations({ subtree: true }) ?? []).some((a) => a.playState === "running" && Number.isFinite(a.effect?.getComputedTiming().endTime));
    const now = key(el);
    equal = now !== "" && now === last && !running ? equal + 1 : 0;
    last = now;
  }
}

/** A dialog or Sheet is visible from the first frame of its slide-in: wait for it to stop, so the pair shows its fields. */
async function opened(page: Page): Promise<void> {
  await dialog(page).last().waitFor({ state: "visible" });
  await page.evaluate(settle);
}

/** The Invite link's dialog, and its "join" button: the one way to the rating step and the start choice. */
async function join(page: Page): Promise<void> {
  await button(page, ptBR["invite.leave.confirm"]).click();
  await dialog(page).getByRole("heading", { name: ptBR["invite.rating.heading"] }).waitFor();
}

/** A row of Me: the button named by its title (a second line can follow), which opens its Sheet. */
const row = (title: string) => async (page: Page) => {
  await page.getByRole("button", { name: new RegExp(`^${title}\\b`) }).click();
  await opened(page);
};

export const OPENERS: Record<State, (page: Page) => Promise<void>> = {
  "check-in": opened,
  // The Sheet is closed with its ✕, as its artboard's "Fechar" link does.
  "check-in-later": async (page) => {
    await dialog(page).getByRole("button", { name: ptBR["checkin.close"], exact: true }).click();
    await dialog(page).waitFor({ state: "hidden" });
  },
  // The Task cards' name buttons are the h3's buttons; the first card is the first of your own Tasks.
  task: async (page) => {
    await page.locator("article h3 button").first().click();
    await opened(page);
  },
  // Swap starts from your own Task: open the first one's Sheet, then its ⋯ menu, then "Oferecer troca", which
  // closes the Task's Sheet and opens the Swap one.
  swap: async (page) => {
    await page.locator("article h3 button").first().click();
    await opened(page);
    await dialog(page).getByRole("button", { name: new RegExp(`^${ptBR["dayplan.task.menu"].replace(" {task}", " ")}`) }).click();
    await button(page, ptBR["dayplan.swap.sheet.title"]).click();
    await dialog(page).getByRole("heading", { name: ptBR["dayplan.swap.sheet.title"] }).waitFor();
    await opened(page);
  },
  streak: async (page) => {
    await button(page, /^Sequência: /).click();
    await opened(page);
  },
  voice: async (page) => {
    await button(page, ptBR["voice.mic"]).click();
    await opened(page);
  },
  "invite-rating": join,
  "start-choice": async (page) => {
    await join(page);
    await button(page, ptBR["invite.rating.done"]).click();
    await dialog(page).getByRole("heading", { name: ptBR["startChoice.heading"] }).waitFor();
  },
  leave: async (page) => {
    await button(page, new RegExp(`^${ptBR["home.leave.open"]}`)).click();
    await opened(page);
  },
  "me-baseline": row(ptBR["profile.baseline.heading"]),
  "me-preferences": row(ptBR["profile.preferences.heading"]),
  "me-restrictions": row(ptBR["profile.restrictions.heading"]),
  "me-appearance": row(ptBR["settings.appearance.label"]),
  "me-account": row(ptBR["me.account.title"]),
  "invite-sheet": async (page) => {
    await button(page, new RegExp(`^${ptBR["invite.share.heading"]}`)).click();
    await opened(page);
  },
  "home-settings": async (page) => {
    await button(page, new RegExp(`^${ptBR["home.settings.card.title"]}`)).click();
    await opened(page);
  },
  // The e-mail travels in the router's history state from the sign-up step; set it as the router would.
  "confirm-email": async (page) => {
    await page.evaluate(() => {
      const state = { usr: { email: "ana@example.test" }, key: "pairs", idx: 1 };
      history.pushState(state, "", "/confirm");
      dispatchEvent(new PopStateEvent("popstate", { state }));
    });
    await page.getByRole("heading", { level: 1 }).waitFor();
  },
};
