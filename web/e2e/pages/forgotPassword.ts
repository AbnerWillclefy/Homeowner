import { expect, type Page } from "@playwright/test";

export const forgotPassword = {
  heading: (page: Page) => page.getByRole("heading", { name: "Reset your password", level: 2 }),
  code: (page: Page) => page.getByLabel("Code from the email"),
  // exact: the show-password button is named "Show password" and would match a loose "New password".
  newPassword: (page: Page) => page.getByLabel("New password", { exact: true }),

  /** Types the email on the first step and asks for the code. */
  async requestCode(page: Page, email: string): Promise<void> {
    await expect(forgotPassword.heading(page)).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send code", exact: true }).click();
  },

  /** The code step names this address and says to check the spam folder. */
  async expectCodeStepFor(page: Page, email: string): Promise<void> {
    const sent = page.getByText("we sent a code to it");
    await expect(sent).toContainText(email);
    await expect(sent).toContainText("check your spam folder");
    await expect(forgotPassword.code(page)).toBeVisible();
  },

  /** Types the code and the new password and submits. */
  async reset(page: Page, code: string, password: string): Promise<void> {
    await forgotPassword.code(page).fill(code);
    await forgotPassword.newPassword(page).fill(password);
    await page.getByRole("button", { name: "Change password", exact: true }).click();
  },
};
