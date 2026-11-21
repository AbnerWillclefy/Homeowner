import type { History } from "../api";
import type { SpendingCategory } from "./categories";

/** One category across the months of a history, oldest first, and whether it never had spending. */
export function categoryHistory(history: History, category: SpendingCategory) {
  const months = history.months.map((m) => ({ month: m.month, cents: m.categories.find((c) => c.category === category)?.spentCents ?? 0 }));
  return { months, allZero: months.every((m) => m.cents === 0) };
}
