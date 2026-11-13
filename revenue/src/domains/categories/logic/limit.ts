import type { SpendingCategory } from "./categories";

export type Limits = Partial<Record<SpendingCategory, number>>;

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

const MAX_CENTS = 1_000_000_000_000; // backend maxBillCents, enforced by PutBudget

/** A limit to save: whole cents above zero, up to the backend maximum. Zero or empty is not a limit; removing one is a separate action. */
export const isValidLimit = (cents: number | null): cents is number =>
  cents !== null && Number.isInteger(cents) && cents > 0 && cents <= MAX_CENTS;
