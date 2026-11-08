import { describe, expect, it } from "vitest";
import { difference, lastMonth } from "./difference";

describe("difference", () => {
  it("says more, less or the same, with the size of the gap", () => {
    expect(difference(81200, 69200)).toEqual({ key: "more", amount: 12000 });
    expect(difference(69200, 81200)).toEqual({ key: "less", amount: 12000 });
    expect(difference(5000, 5000)).toEqual({ key: "same", amount: 0 });
  });

  it("counts a zero previous month as more, and a zero month as less", () => {
    expect(difference(5000, 0)).toEqual({ key: "more", amount: 5000 });
    expect(difference(0, 5000)).toEqual({ key: "less", amount: 5000 });
  });

  it("works across negatives (refund-heavy months)", () => {
    expect(difference(-2000, 3000)).toEqual({ key: "less", amount: 5000 });
    expect(difference(1000, -2000)).toEqual({ key: "more", amount: 3000 });
  });
});

describe("lastMonth", () => {
  const report = {
    month: { month: "2026-11", spentCents: 97780, categories: [{ category: "housing" as const, spentCents: 80000 }] },
    previous: {
      month: "2026-10",
      spentCents: 127270,
      categories: [
        { category: "housing" as const, spentCents: 80000 },
        { category: "health" as const, spentCents: 8990 },
        { category: "household_bills" as const, spentCents: 30500 },
        { category: "leisure" as const, spentCents: 0 },
      ],
    },
  };

  it("gives last month's spend by category", () => {
    expect(lastMonth(report, ["housing"]).spentBy.get("housing")).toBe(80000);
  });

  it("lists only categories spent last month and not shown, biggest first", () => {
    expect(lastMonth(report, ["housing"]).only).toEqual([
      { category: "household_bills", spentCents: 30500 },
      { category: "health", spentCents: 8990 },
    ]);
  });

  it("says the difference of the totals", () => {
    expect(lastMonth(report, []).diff).toEqual({ key: "less", amount: 29490 });
  });
});
