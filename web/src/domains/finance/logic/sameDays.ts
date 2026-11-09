import type { Transaction } from "../api/api";
import { scaleMax } from "./chart";
import { addMonths, currentMonth, daysInMonth, type Month } from "./month";
import { spent } from "./monthView";
import type { SpendingCategory } from "./spendingCategories";

export interface SameDays {
  spent: number;
  previousSpent: number;
  /** The day the previous month is cut at; null for a past month, which is compared whole. */
  cutDay: number | null;
  /** The previous month has no Transactions at all, so the copy can say there is nothing to compare with. */
  noPrevious: boolean;
  byCategory: Map<SpendingCategory, { spent: number; previousSpent: number }>;
}

const dayOf = (date: string) => Number(date.slice(8, 10));

/**
 * This month against the same days of the previous one. Expenses only, a refund offsets (`spent`), and no category
 * is Other: the same rules as `monthView`, so the two cannot disagree. Posted dates are compared as day numbers
 * from the string, never as `Date`, and by `countsOn`, so a card charge counts on its bill's due day.
 */
export function sameDays(current: Transaction[], previous: Transaction[], month: Month, today: Date): SameDays {
  const cutDay = month === currentMonth(today) ? Math.min(today.getDate(), daysInMonth(addMonths(month, -1))) : null;
  const byCategory: SameDays["byCategory"] = new Map();
  const total = { spent: 0, previousSpent: 0 };
  const add = (rows: Transaction[], key: "spent" | "previousSpent", cut: number | null) => {
    for (const tx of rows) {
      if (tx.type !== "expense" || (cut !== null && dayOf(tx.countsOn) > cut)) continue;
      const category = tx.spendingCategory ?? "other";
      const entry = byCategory.get(category) ?? { spent: 0, previousSpent: 0 };
      entry[key] += spent(tx);
      byCategory.set(category, entry);
      total[key] += spent(tx);
    }
  };
  add(current, "spent", null);
  add(previous, "previousSpent", cutDay);
  return { ...total, cutDay, noPrevious: previous.length === 0, byCategory };
}

/** Every category with something in either month, biggest spend first, and the one scale their bars and markers share. */
export function categoryRows(byCategory: SameDays["byCategory"]) {
  const rows = [...byCategory]
    .filter(([, v]) => v.spent !== 0 || v.previousSpent !== 0)
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.spent - a.spent || b.previousSpent - a.previousSpent);
  return { rows, max: scaleMax(rows.map((r) => r.spent), rows.map((r) => r.previousSpent)) };
}

/** Transactions by posted day, newest day first. */
export function groupByDay(rows: Transaction[]): { day: string; transactions: Transaction[] }[] {
  const days = new Map<string, Transaction[]>();
  for (const tx of rows) days.set(tx.postedOn, [...(days.get(tx.postedOn) ?? []), tx]);
  return [...days]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, transactions]) => ({ day, transactions }));
}

/** The Expenses with no Spending Category the server could settle. */
export const uncategorised = (rows: Transaction[]): Transaction[] =>
  rows.filter((tx) => tx.type === "expense" && tx.categorySetBy === "fallback");
