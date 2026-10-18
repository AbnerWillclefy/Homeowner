import { expect, type Page } from "@playwright/test";

/** The four tabs, in the order the bar shows them. */
export const TABS = ["Today", "Chores", "Home", "Me"] as const;

export const shell = {
  nav: (page: Page) => page.getByRole("navigation", { name: "Main" }),
  tab: (page: Page, name: (typeof TABS)[number]) => shell.nav(page).getByRole("link", { name, exact: true }),

  /** The signed-in app is open on Today: its heading, and the Main bar with all four tabs. */
  async expectOnToday(page: Page): Promise<void> {
    await expect(page.getByRole("heading", { name: "Today", level: 2 })).toBeVisible();
    await expect(shell.nav(page)).toBeVisible();
    for (const name of TABS) await expect(shell.tab(page, name)).toBeVisible();
    await expect(shell.tab(page, "Today")).toHaveAttribute("aria-current", "page");
    await expect(page).not.toHaveURL(/\/welcome/);
  },
};
