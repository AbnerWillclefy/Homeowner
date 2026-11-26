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
export function undersized(declared: number, rendered: number): boolean;
export function heightFailures(key: string, found: { description: string; declared: number; rendered: number }[], exempt: Record<string, string>): string[];

export type Boxes = Record<string, { x: number; width: number; height: number; gap: number | null }[]>;
export interface BoxDiff {
  role: string;
  index?: number;
  prop: "count" | "x" | "width" | "height" | "gap";
  app: number;
  design: number;
}
export interface Measure {
  diffs: BoxDiff[];
  small: number;
}
export function roleSelectors(side: "app" | "design"): Record<string, string>;
/** Runs in the page, so it is passed to `page.evaluate` with `roleSelectors(...)` and uses nothing outside itself. */
export function measureBoxes(selectors: Record<string, string>): Boxes;
export function compareBoxes(app: Boxes, design: Boxes, threshold?: number): Measure;
