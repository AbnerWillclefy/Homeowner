import type { Locator, Page } from "@playwright/test";

/** The Resumo / Gastos / Contas links under the Finances title, one route each. */
export const financeNav = (page: Page): Locator => page.getByRole("navigation", { name: /^(Finanças|Finances)$/ });

/** One Finances view's link, by its label. */
export const financeView = (page: Page, name: string | RegExp): Locator => financeNav(page).getByRole("link", { name, exact: typeof name === "string" });
