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

  /** The email field holds this address (sign-up and confirmation hand it over). */
  async expectEmail(page: Page, email: string): Promise<void> {
    await expect(signIn.email(page)).toHaveValue(email);
  },

  async signIn(page: Page, email: string, password: string): Promise<void> {
    await signIn.email(page).fill(email);
    await signIn.password(page).fill(password);
    await signIn.submit(page).click();
  },

  /** The link-styled button under the form that opens the sign-up screen. */
  async openSignUp(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
  },

  /** The form's alert region shows this text. The region is always present, so the text is what counts. */
  async expectError(page: Page, text: string): Promise<void> {
    await expect(page.getByRole("alert")).toContainText(text);
  },

  /** The success notice shown after email confirmation (a toast, so assert it right after the redirect). */
  async expectConfirmedNotice(page: Page): Promise<void> {
    await expect(page.getByText("Your email is confirmed. Sign in to start.", { exact: true })).toBeVisible();
  },
};
