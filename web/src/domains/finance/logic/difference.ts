import type { ReportResponse } from "../api/api";
import type { SpendingCategory } from "./spendingCategories";

export type DifferenceKey = "more" | "less" | "same";

/** How this month's spending compares with the previous one. `amount` is never negative. */
export function difference(current: number, previous: number): { key: DifferenceKey; amount: number } {
  const gap = current - previous;
  return { key: gap > 0 ? "more" : gap < 0 ? "less" : "same", amount: Math.abs(gap) };
}

/**
 * Last month's spend by category, and the categories with spending only last month (biggest first), so the month
 * view can say what changed without listing every category at zero.
 */
export function lastMonth(report: ReportResponse, shown: readonly SpendingCategory[]) {
  return {
    spentBy: new Map(report.previous.categories.map((c) => [c.category, c.spentCents])),
    only: report.previous.categories.filter((c) => c.spentCents > 0 && !shown.includes(c.category)).sort((a, b) => b.spentCents - a.spentCents),
    diff: difference(report.month.spentCents, report.previous.spentCents),
  };
}
