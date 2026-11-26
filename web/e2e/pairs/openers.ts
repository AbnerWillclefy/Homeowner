import type { Page } from "@playwright/test";
import { ptBR } from "../../src/shared/i18n/catalogs/pt-BR";
import type { State } from "./screens";

// Each opener takes the loaded screen to its state, by role and by the pt-BR catalog's own words, so a reworded
// button follows the catalog. No `expect` here: screens.test.ts imports this file under Vitest, not Playwright.

const dialog = (page: Page) => page.getByRole("dialog");
const button = (page: Page, name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });

async function opened(page: Page): Promise<void> {
  await dialog(page).waitFor({ state: "visible" });
}

/** The Invite link's dialog, and its "join" button: the one way to the rating step and the start choice. */
async function join(page: Page): Promise<void> {
  await button(page, ptBR["invite.leave.confirm"]).click();
  await dialog(page).getByRole("heading", { name: ptBR["invite.rating.heading"] }).waitFor();
}

export const OPENERS: Record<State, (page: Page) => Promise<void>> = {
  "check-in": opened,
  "check-in-later": async (page) => {
    await button(page, ptBR["checkin.cancel"]).click();
    await dialog(page).waitFor({ state: "hidden" });
  },
  swap: async (page) => {
    await button(page, new RegExp(`^${ptBR["dayplan.action.swap"]}`)).first().click();
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
    await button(page, ptBR["home.leave.open"]).click();
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
