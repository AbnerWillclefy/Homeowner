import { describe, expect, it } from "vitest";
import type { History } from "../api/api";
import { categoryHistory } from "./history";

const history: History = {
  to: "2026-01",
  months: [
    { month: "2025-12", spentCents: 500, categories: [{ category: "groceries", spentCents: 500 }] },
    { month: "2026-01", spentCents: 900, categories: [{ category: "groceries", spentCents: -100 }, { category: "leisure", spentCents: 1000 }] },
  ],
};

describe("categoryHistory", () => {
  it("slices one category, oldest first, across a year boundary", () => {
    expect(categoryHistory(history, "groceries")).toEqual({
      months: [{ month: "2025-12", cents: 500 }, { month: "2026-01", cents: -100 }],
      allZero: false,
    });
  });
  it("reads a month without the category as zero", () => {
    expect(categoryHistory(history, "leisure").months.map((m) => m.cents)).toEqual([0, 1000]);
  });
  it("flags a category with no spending", () => {
    expect(categoryHistory(history, "pets").allZero).toBe(true);
  });
});
