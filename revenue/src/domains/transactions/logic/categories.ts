import type { SpendingCategoryId } from "@homeowner/bedrock/finance";
import type { MessageKey } from "../../../shared/i18n/catalogs";

/** The ids the API stores, in the order the picker lists them. */
export const SPENDING_CATEGORIES = [
  "housing", "household_bills", "groceries", "eating_out", "transport", "health", "education",
  "leisure", "shopping", "subscriptions", "pets", "taxes_fees", "other",
] as const;

export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];

export const spendingKey = (id: SpendingCategory): MessageKey => `spending.${id}`;

/** Bedrock spells its ids with hyphens. An Expense with no category yet is Other. */
export const tagOf = (id: SpendingCategory | null): SpendingCategoryId => (id ?? "other").replace("_", "-") as SpendingCategoryId;
