import type { MonthResponse } from "../api/api";
import type { SpendingCategory } from "./spendingCategories";

export type Limits = MonthResponse["limits"];

/** Where the spending stands against the limit. `amount` is never negative; a refund-heavy (negative) spend is "under" by the right amount. */
export function limitText(spent: number, limit: number): { key: "under" | "over" | "at"; amount: number } {
  const gap = limit - spent;
  return { key: gap > 0 ? "under" : gap < 0 ? "over" : "at", amount: Math.abs(gap) };
}

/** The limits with one category set, or removed when `cents` is null. */
export function withLimit(limits: Limits, category: SpendingCategory, cents: number | null): Limits {
  const rest = { ...limits };
  delete rest[category];
  return cents === null ? rest : { ...rest, [category]: cents };
}
