import type { MessageKey } from "../../../shared/i18n";

/** The ids the API stores, in the order the picker lists them. */
export const SPENDING_CATEGORIES = [
  "housing", "household_bills", "groceries", "eating_out", "transport", "health", "education",
  "leisure", "shopping", "subscriptions", "pets", "taxes_fees", "other",
] as const;

export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];

/** Their own `spending.*` keys: the Chore Category `pets` label is a different vocabulary. */
export const spendingKey = (id: SpendingCategory): MessageKey => `spending.${id}` as MessageKey;
