import { expect, type Page } from "@playwright/test";

/** The form's alert region shows this text. The region is always present, so the text is what counts. */
export async function expectFormError(page: Page, text: string): Promise<void> {
  await expect(page.getByRole("alert")).toContainText(text);
}
