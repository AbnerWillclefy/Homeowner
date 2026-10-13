import { expect, type Page } from "@playwright/test";

export const signIn = {
  heading: (page: Page) => page.getByRole("heading", { name: "Sign in", level: 2 }),
  email: (page: Page) => page.getByLabel("Email"),
  // exact: the show-password button is named "Show password" and would match a loose "Password".
  password: (page: Page) => page.getByLabel("Password", { exact: true }),
  submit: (page: Page) => page.getByRole("button", { name: "Sign in", exact: true }),

  /** The sign-in screen has rendered. */
  async expectVisible(page: Page): Promise<void> {
    await expect(signIn.heading(page)).toBeVisible();
    await expect(signIn.email(page)).toBeVisible();
    await expect(signIn.password(page)).toBeVisible();
    await expect(signIn.submit(page)).toBeVisible();
  },
};
