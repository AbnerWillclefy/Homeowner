import type { Transaction } from "../api/api";
import { addMonths, daysInMonth, type Month } from "./month";
import { spent } from "./monthView";

/** Cumulative spend per day, day 1 first, over `days` days. Expenses only, a refund offsets: the `spent` rule of Gastos. */
function cumulative(rows: Transaction[], days: number): number[] {
  const perDay = Array<number>(days).fill(0);
  for (const tx of rows) {
    const day = Number(tx.postedOn.slice(8, 10));
    if (tx.type === "expense" && day >= 1 && day <= days) perDay[day - 1]! += spent(tx);
  }
  let total = 0;
  return perDay.map((cents) => (total += cents));
}

/** This month from day 1 to today against the previous month, whole. Deleted again by #484, so kept small. */
export function paceSeries(current: Transaction[], previous: Transaction[], month: Month, today: Date): { current: number[]; previous: number[] } {
  return { current: cumulative(current, today.getDate()), previous: cumulative(previous, daysInMonth(addMonths(month, -1))) };
}
