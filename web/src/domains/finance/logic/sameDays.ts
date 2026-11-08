import type { Transaction } from "../api/api";
import { addMonths, currentMonth, type Month } from "./month";
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

const dayOf = (postedOn: string) => Number(postedOn.slice(8, 10));

function lastDay(month: Month): number {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m, 0).getDate();
}

/**
 * This month against the same days of the previous one. Expenses only, a refund offsets (`spent`), and no category
 * is Other: the same rules as `monthView`, so the two cannot disagree. Posted dates are compared as day numbers
 * from the string, never as `Date`.
 */
export function sameDays(current: Transaction[], previous: Transaction[], month: Month, today: Date): SameDays {
  const cutDay = month === currentMonth(today) ? Math.min(today.getDate(), lastDay(addMonths(month, -1))) : null;
  const byCategory: SameDays["byCategory"] = new Map();
  const total = { spent: 0, previousSpent: 0 };
  const add = (rows: Transaction[], key: "spent" | "previousSpent", cut: number | null) => {
    for (const tx of rows) {
      if (tx.type !== "expense" || (cut !== null && dayOf(tx.postedOn) > cut)) continue;
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

/** The Expenses with no Spending Category the server could settle. */
export const uncategorised = (rows: Transaction[]): Transaction[] =>
  rows.filter((tx) => tx.type === "expense" && tx.categorySetBy === "fallback");
