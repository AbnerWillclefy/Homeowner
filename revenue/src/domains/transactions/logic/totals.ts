import type { Transaction } from "../api";
import { isUncategorised } from "./filter";

export interface Totals {
  /** What the Expenses cost, a refund coming off: the same rule as the API's `spentCents`. */
  spentCents: number;
  incomeCents: number;
  uncategorised: number;
}

/** The month's totals from its loaded rows. They are for the whole month, never for the filtered rows. */
export function totalsOf(rows: Transaction[]): Totals {
  let spentCents = 0;
  let incomeCents = 0;
  let uncategorised = 0;
  for (const tx of rows) {
    if (tx.type === "expense") spentCents -= tx.amountCents;
    if (tx.type === "income") incomeCents += tx.amountCents;
    if (isUncategorised(tx)) uncategorised++;
  }
  return { spentCents, incomeCents, uncategorised };
}

export interface DayGroup {
  day: string;
  rows: Transaction[];
}

/**
 * The rows under their day, newest day first. A card purchase counts on its bill's month (`countsOn`), but the day
 * heading is `postedOn`, the day the User recognises.
 */
export function groupByDay(rows: Transaction[]): DayGroup[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of [...rows].sort((a, b) => b.postedOn.localeCompare(a.postedOn))) {
    groups.set(tx.postedOn, [...(groups.get(tx.postedOn) ?? []), tx]);
  }
  return [...groups].map(([day, dayRows]) => ({ day, rows: dayRows }));
}

export const sourceCount = (rows: Transaction[]) => new Set(rows.map((tx) => tx.sourceName)).size;
