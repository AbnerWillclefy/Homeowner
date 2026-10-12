import { categoryStyle } from "./categoryStyle";

export interface CategoryGroup<T> {
  /** A Category id the app knows; anything else is "other". */
  category: string;
  chores: T[];
}

/**
 * Chores by Category, in the order the Categories come from the API, each group in the Chores' own order.
 * Empty Categories are left out, one missing from the list still gets a group, and a Category the app has no
 * style for is grouped under "other", last.
 */
export function groupByCategory<T extends { category: string }>(chores: readonly T[], categories: readonly string[]): CategoryGroup<T>[] {
  const known = chores.map((chore) => categoryStyle(chore.category).id);
  const order = [...new Set([...categories, ...known])].filter((id) => id !== "other").concat("other");
  return order
    .map((category) => ({ category, chores: chores.filter((chore) => categoryStyle(chore.category).id === category) }))
    .filter((group) => group.chores.length > 0);
}
