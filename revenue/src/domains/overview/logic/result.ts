import type { HistoryMonth } from "../api/api";

/** What was left of the month: income less what was spent and what was put aside (Transfers are in none of them). */
export const resultCents = (m: Pick<HistoryMonth, "incomeCents" | "spentCents" | "savedCents">): number => m.incomeCents - m.spentCents - m.savedCents;

/**
 * The change of this month's result against the whole previous month's, as a rounded percent. Null (badge hidden) when the
 * previous month has no data or its result is zero or negative: a percent of that base misleads.
 */
export function resultChange(current: HistoryMonth, previous: HistoryMonth | undefined): number | null {
  if (!previous || (previous.incomeCents === 0 && previous.spentCents === 0 && previous.savedCents === 0)) return null;
  const base = resultCents(previous);
  return base > 0 ? Math.round(((resultCents(current) - base) / base) * 100) : null;
}
