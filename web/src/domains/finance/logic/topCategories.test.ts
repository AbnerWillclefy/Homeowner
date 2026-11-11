import { describe, expect, it } from "vitest";
import type { MonthView } from "./monthView";
import { topCategories } from "./topCategories";

const view = (...spent: number[]): MonthView => ({
  spentCents: 0,
  categories: spent.map((spentCents, i) => ({ category: (["groceries", "leisure", "health", "pets"] as const)[i]!, spentCents, transactions: [] })),
  transfers: [],
  savings: [],
  income: [],
  isEmpty: false,
});

describe("topCategories", () => {
  it("takes the first three that spent something", () => {
    expect(topCategories(view(900, 500, 300, 100), 3).map((c) => c.spentCents)).toEqual([900, 500, 300]);
  });

  it("skips categories that net to zero or less (all refunded)", () => {
    expect(topCategories(view(900, 0, -200), 3).map((c) => c.spentCents)).toEqual([900]);
  });

  it("is empty when nothing was spent", () => {
    expect(topCategories(view(), 3)).toEqual([]);
  });
});
