import type { CardTransaction } from "./../api";

/** The card's rows that count in `month` (`YYYY-MM`), newest first, by `countsOn`.
 * shortcut: the outlook builds an open bill after a bank bill only from charges posted on or after the latest closing, so this can list earlier ones; expose that cutoff from the API to match. */
export function billRows(rows: readonly CardTransaction[], sourceId: string, month: string): CardTransaction[] {
  return rows
    .filter((r) => r.sourceId === sourceId && r.countsOn.startsWith(month))
    .sort((a, b) => b.postedOn.localeCompare(a.postedOn) || a.id.localeCompare(b.id));
}
