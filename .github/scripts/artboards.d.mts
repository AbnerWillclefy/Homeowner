// Types for artboards.mjs, so the web app's Playwright code (TypeScript) uses the same functions as the scripts.
import type { Page } from "@playwright/test";

export interface Measured {
  scrollWidth: number;
  innerWidth: number;
  offenders: { description: string; right: number }[];
}
export function overflowOf(route: string, measured: Measured): string | null;
/** Runs in the page, so it is passed to `page.evaluate` and uses nothing outside itself. */
export function measureOverflow(): Measured;
export function shootArtboard(page: Page, dir: string, file: string, viewport: { width: number; height: number }, path: string, css?: string): Promise<void>;
