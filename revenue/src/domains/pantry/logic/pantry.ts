import type { PantryItem } from "../api";

const byName = (a: PantryItem, b: PantryItem) => a.name.localeCompare(b.name);

/** Ran out (the latest first) and in stock (by name). */
export function groupItems(items: PantryItem[]): { out: PantryItem[]; stock: PantryItem[] } {
  const out = items.filter((i) => i.state === "ran_out").sort((a, b) => (b.ranOutOn ?? "").localeCompare(a.ranOutOn ?? "") || byName(a, b));
  const stock = items.filter((i) => i.state === "in_stock").sort(byName);
  return { out, stock };
}

/** The item with its run-out marked or taken off; `today` is `YYYY-MM-DD` in São Paulo. */
export const withRanOut = (item: PantryItem, ranOut: boolean, today: string): PantryItem =>
  ranOut ? { ...item, state: "ran_out", ranOutOn: today } : { ...item, state: "in_stock", ranOutOn: null };

/** Whole days from `from` to `to`, both `YYYY-MM-DD`; read as UTC dates so no time zone or daylight saving moves it. */
export function daysBetween(from: string, to: string): number {
  const utc = (d: string) => Date.parse(`${d}T00:00:00Z`);
  return Math.max(0, Math.round((utc(to) - utc(from)) / 86_400_000));
}

export const MAX_NAME = 60; // backend pantry maxLen, for names and brands

export type ItemFormResult = { ok: true; name: string; brand: string | null } | { ok: false; errors: Record<string, string> };

/** Checks what was typed before it is sent; the codes are the API's, so one table of messages serves both. An empty brand means none. */
export function itemFormOf(fields: { name: string; brand: string }): ItemFormResult {
  const name = fields.name.trim();
  const brand = fields.brand.trim();
  const errors: Record<string, string> = {};
  if (name === "") errors.name = "required";
  else if ([...name].length > MAX_NAME) errors.name = "too_long";
  if ([...brand].length > MAX_NAME) errors.preferredBrand = "too_long";
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, name, brand: brand || null };
}
