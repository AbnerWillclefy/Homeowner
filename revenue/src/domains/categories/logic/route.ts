import { SPENDING_CATEGORIES, type SpendingCategory } from "./categories";

/** The Spending Category in `/categories/:category`, or null for an unknown or missing id. */
export const categoryOf = (id: string | undefined): SpendingCategory | null =>
  (SPENDING_CATEGORIES as readonly string[]).includes(id ?? "") ? (id as SpendingCategory) : null;
