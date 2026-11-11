import type { MonthResponse, Transaction } from "../api/api";
import type { SpendingCategory } from "./spendingCategories";

/** What an Expense cost: a refund (money in, typed Expense) comes out negative. */
export const spent = (tx: Transaction): number => -tx.amountCents;

export interface CategoryGroup {
  category: SpendingCategory;
  spentCents: number;
  transactions: Transaction[];
}

export interface MonthView {
  spentCents: number;
  categories: CategoryGroup[];
  /** Left out of the totals. Saving rows sit here until they get their own group. */
  transfers: Transaction[];
  income: Transaction[];
  isEmpty: boolean;
}

/** Expenses by category, biggest spend first; transfers and income apart. An Expense not yet categorised counts as Other. */
export function monthView(response: MonthResponse): MonthView {
  const groups = new Map<SpendingCategory, CategoryGroup>();
  const transfers: Transaction[] = [];
  const income: Transaction[] = [];
  for (const tx of response.transactions) {
    if (tx.type === "transfer" || tx.type === "saving") transfers.push(tx);
    else if (tx.type === "income") income.push(tx);
    else {
      const category = tx.spendingCategory ?? "other";
      const group = groups.get(category) ?? { category, spentCents: 0, transactions: [] };
      group.spentCents += spent(tx);
      group.transactions.push(tx);
      groups.set(category, group);
    }
  }
  return {
    spentCents: response.spentCents,
    categories: [...groups.values()].sort((a, b) => b.spentCents - a.spentCents),
    transfers,
    income,
    isEmpty: response.transactions.length === 0,
  };
}
