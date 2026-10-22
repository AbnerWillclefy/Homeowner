import type { Page } from "@playwright/test";

/**
 * Holds every non-document request whose URL matches `pattern` until `release()` is called, then lets the fake answer
 * it. Page loads (the document) pass straight through, so a held read never blocks the app from starting.
 */
export function hold(page: Page, pattern: RegExp): { release(): void } {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  void page.route(pattern, async (route) => {
    if (route.request().resourceType() === "document") return route.fallback();
    await released;
    await route.fallback();
  });
  return { release };
}
