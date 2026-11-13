import type { CardTransaction } from "./../api";

/** The card's rows that count in `month` (`YYYY-MM`), newest first: the same `countsOn` rule the outlook uses. */
export function billRows(rows: readonly CardTransaction[], sourceId: string, month: string): CardTransaction[] {
  return rows
    .filter((r) => r.sourceId === sourceId && r.countsOn.startsWith(month))
    .sort((a, b) => b.postedOn.localeCompare(a.postedOn) || a.id.localeCompare(b.id));
}

/** What the rows add up to as a bill: money out is positive. */
export const rowsTotal = (rows: readonly CardTransaction[]): number => rows.reduce((sum, r) => sum - r.amountCents, 0);
