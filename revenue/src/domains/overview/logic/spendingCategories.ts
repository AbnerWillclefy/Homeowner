/** The Spending Category ids the API stores. */
export const SPENDING_CATEGORIES = [
  "housing", "household_bills", "groceries", "eating_out", "transport", "health", "education",
  "leisure", "shopping", "subscriptions", "pets", "taxes_fees", "other",
] as const;

export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];
