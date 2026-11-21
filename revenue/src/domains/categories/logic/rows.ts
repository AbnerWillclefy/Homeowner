import type { Spending } from "../api";
import type { SpendingCategory } from "./categories";

export interface CategoryRow {
  category: SpendingCategory;
  spentCents: number;
  limit: number | undefined;
}

/** The categories with something spent or a limit set, biggest spender first. */
export function categoryRows({ categories, limits }: Pick<Spending, "categories" | "limits">): CategoryRow[] {
  const spent = new Map(categories.map((c) => [c.category, c.spentCents]));
  const ids = new Set<SpendingCategory>([...spent.keys(), ...(Object.keys(limits) as SpendingCategory[])]);
  return [...ids]
    .map((category) => ({ category, spentCents: spent.get(category) ?? 0, limit: limits[category] }))
    .filter((r) => r.spentCents !== 0 || r.limit !== undefined)
    .sort((a, b) => b.spentCents - a.spentCents);
}
