// RULE: files in pages/ import only "@playwright/test" and other pages/ files. Nothing from the fakes folder,
// no settings file, no base URLs of their own. That is what lets a later run against a real deployment reuse
// pages/ unchanged. Reviewers check it with a grep for the two folder and file names in the imports.
import type { Page } from "@playwright/test";

/**
 * Opens the app at the root of baseURL and returns when the page load event has fired. It does not wait for the
 * app: use web-first assertions (expect(locator).toBeVisible()), which wait for React to mount.
 */
export async function launchApp(page: Page, baseURL: string): Promise<void> {
  await page.goto(new URL("/", baseURL).toString(), { waitUntil: "load" });
}

/** Opens a path of the same app, for deep links. Relative, so it follows the configured baseURL. */
export async function visit(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "load" });
}
