import { expect, type Page } from "@playwright/test";

/** The four tabs, in the order the bar shows them. */
export const TABS = ["Today", "Chores", "Home", "Me"] as const;

type Tab = (typeof TABS)[number];

const PATHS: Record<Tab, string> = { Today: "/", Chores: "/chores", Home: "/home", Me: "/me" };

export const shell = {
  nav: (page: Page) => page.getByRole("navigation", { name: "Main" }),
  tab: (page: Page, name: Tab) => shell.nav(page).getByRole("link", { name, exact: true }),

  /** Clicks a tab in the Main bar. */
  async openTab(page: Page, name: Tab): Promise<void> {
    await shell.tab(page, name).click();
  },

  /** The tab is the current one: its link is marked and the address is its path. */
  async expectOnTab(page: Page, name: Tab): Promise<void> {
    await expect(shell.tab(page, name)).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveURL((url) => url.pathname === PATHS[name]);
  },

  /** The signed-in app is open on Today: its heading, and the Main bar with all four tabs. */
  async expectOnToday(page: Page): Promise<void> {
    await expect(page.getByRole("heading", { name: "Today", level: 2 })).toBeVisible();
    await expect(shell.nav(page)).toBeVisible();
    for (const name of TABS) await expect(shell.tab(page, name)).toBeVisible();
    await expect(shell.tab(page, "Today")).toHaveAttribute("aria-current", "page");
    await expect(page).not.toHaveURL(/\/welcome/);
  },
};
