import type { History } from "../api/api";
import type { SpendingCategory } from "./spendingCategories";

/** One category across the months of one cached history, oldest first, and whether it never had spending. */
export function categoryHistory(history: History, category: SpendingCategory) {
  const months = history.months.map((m) => ({
    month: m.month,
    cents: m.categories.find((c) => c.category === category)?.spentCents ?? 0,
  }));
  return { months, allZero: months.every((m) => m.cents === 0) };
}
