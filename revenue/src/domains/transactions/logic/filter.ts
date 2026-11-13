import type { Transaction, TransactionType } from "../api";
import type { SpendingCategory } from "./categories";

export interface Filter {
  type: TransactionType | "all";
  category: SpendingCategory | "all";
}

/** Client-side, over the month's rows. An Expense with no category yet counts as Other, as in Finances. */
export function filterRows(rows: Transaction[], { type, category }: Filter): Transaction[] {
  return rows.filter(
    (tx) => (type === "all" || tx.type === type) && (category === "all" || (tx.type === "expense" && (tx.spendingCategory ?? "other") === category)),
  );
}
