import { describe, expect, it } from "vitest";
import type { Transaction } from "../api";
import { dailySpend, limitPace } from "./daily";

const tx = (postedOn: string, amountCents: number, over: Partial<Transaction> = {}): Transaction =>
  ({ id: postedOn + amountCents, postedOn, description: "x", sourceName: "", amountCents, type: "expense", spendingCategory: "groceries", categorySetBy: "auto", ...over });

describe("dailySpend", () => {
  const rows = [tx("2030-01-01", -1000), tx("2030-01-01", -500), tx("2030-01-03", -3000), tx("2030-01-03", 400), tx("2030-01-04", -700, { spendingCategory: null, categorySetBy: "fallback" }), tx("2030-01-02", 9000, { type: "income", spendingCategory: null })];

  it("buckets expenses by day, a quiet day is 0 and income is left out", () => {
    expect(dailySpend(rows, 5).map((d) => d.cents)).toEqual([1500, 0, 2600, 700, 0]);
  });

  it("offsets a refund on its day and counts an uncategorised expense", () => {
    expect(dailySpend(rows, 4).map((d) => d.cents)).toEqual([1500, 0, 2600, 700]);
  });

  it("adds up to what the categories total says (the API's rule)", () => {
    const categories = [{ category: "groceries", spentCents: 1000 + 500 + 3000 - 400 }, { category: "other", spentCents: 700 }];
    expect(dailySpend(rows, 31).reduce((n, d) => n + d.cents, 0)).toBe(categories.reduce((n, c) => n + c.spentCents, 0));
  });

  it("averages the days there are at first, then the last 7", () => {
    const days = dailySpend([tx("2030-01-01", -700), tx("2030-01-02", -700), tx("2030-01-08", -7000)], 8);
    expect(days.map((d) => d.average)).toEqual([700, 700, 467, 350, 280, 233, 200, 1100]);
  });

  it("ignores rows past the last day", () => {
    expect(dailySpend([tx("2030-01-09", -100)], 8).every((d) => d.cents === 0)).toBe(true);
  });
});

describe("limitPace", () => {
  it("spreads the limits over the days", () => expect(limitPace({ groceries: 20000, pets: 11000 }, 31)).toBe(1000));
  it("is undefined with no limit", () => expect(limitPace({}, 31)).toBeUndefined());
});
