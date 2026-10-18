import { expect, type Page } from "@playwright/test";

export const confirm = {
  heading: (page: Page) => page.getByRole("heading", { name: "Confirm your email", level: 2 }),

  /** The confirmation screen is open and names this address. */
  async expectFor(page: Page, email: string): Promise<void> {
    await expect(confirm.heading(page)).toBeVisible();
    await expect(page.getByText("We sent a code to")).toContainText(email);
  },

  /** Types the code and submits it. */
  async enterCode(page: Page, code: string): Promise<void> {
    await page.getByLabel("Code from the email").fill(code);
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
  },
};
