import { expect, type Page } from "@playwright/test";
import { expectFormError } from "./form";

export const signUp = {
  heading: (page: Page) => page.getByRole("heading", { name: "Sign up", level: 2 }),
  email: (page: Page) => page.getByLabel("Email"),
  // exact: each password field has a sibling "Show password" button that a loose label would also match.
  password: (page: Page) => page.getByLabel("Password", { exact: true }),
  confirm: (page: Page) => page.getByLabel("Confirm password", { exact: true }),
  submit: (page: Page) => page.getByRole("button", { name: "Sign up", exact: true }),

  async expectVisible(page: Page): Promise<void> {
    await expect(signUp.heading(page)).toBeVisible();
    await expect(signUp.submit(page)).toBeVisible();
  },

  async fill(page: Page, values: { email: string; password: string; confirm: string }): Promise<void> {
    await signUp.email(page).fill(values.email);
    await signUp.password(page).fill(values.password);
    await signUp.confirm(page).fill(values.confirm);
  },

  async submitForm(page: Page): Promise<void> {
    await signUp.submit(page).click();
  },

  expectError: expectFormError,
};
