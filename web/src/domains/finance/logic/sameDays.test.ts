import { describe, expect, it } from "vitest";
import type { Transaction } from "../api/api";
import { categoryRows, groupByDay, sameDays, uncategorised } from "./sameDays";

const tx = (postedOn: string, amountCents: number, over: Partial<Transaction> = {}): Transaction => ({
  id: postedOn + amountCents, postedOn, countsOn: postedOn, description: "x", sourceName: "Nubank", amountCents, currency: "BRL",
  type: "expense", spendingCategory: "groceries", categorySetBy: "auto", ...over,
});
const on = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("sameDays", () => {
  it("cuts the previous month at the day of the month", () => {
    const r = sameDays(
      [tx("2026-11-02", -1000)],
      [tx("2026-10-02", -400), tx("2026-10-08", -600), tx("2026-10-09", -9000)],
      "2026-11",
      on(2026, 11, 8),
    );
    expect(r).toMatchObject({ spent: 1000, previousSpent: 1000, cutDay: 8, noPrevious: false });
    expect(r.byCategory.get("groceries")).toEqual({ spent: 1000, previousSpent: 1000 });
  });

  it("cuts a card charge by the day its bill is due, not the day it posted", () => {
    // Posted on 20 September, on October's bill due the 12th: before the cut at the 8th it does not count yet.
    const r = sameDays([], [tx("2026-09-20", -500, { countsOn: "2026-10-12" }), tx("2026-10-05", -100, { countsOn: "2026-10-05" })], "2026-11", on(2026, 11, 8));
    expect(r.previousSpent).toBe(100);
  });

  it("leaves out this month's card bill until its due day", () => {
    const r = sameDays([tx("2026-10-20", -500, { countsOn: "2026-11-12" }), tx("2026-11-05", -100), tx("2026-11-09", -10)], [], "2026-11", on(2026, 11, 8));
    expect(r.spent).toBe(110);
  });

  it("clamps day 31 to the whole of a 30-day month", () => {
    const r = sameDays([], [tx("2026-09-01", -100), tx("2026-09-30", -200)], "2026-10", on(2026, 10, 31));
    expect(r.cutDay).toBe(30);
    expect(r.previousSpent).toBe(300);
  });

  it("clamps 30 March to February, in a leap year and not", () => {
    expect(sameDays([], [tx("2026-02-28", -100)], "2026-03", on(2026, 3, 30))).toMatchObject({ cutDay: 28, previousSpent: 100 });
    expect(sameDays([], [tx("2028-02-28", -100), tx("2028-02-29", -50)], "2028-03", on(2028, 3, 30))).toMatchObject({ cutDay: 29, previousSpent: 150 });
  });

  it("compares a past month whole against whole", () => {
    const r = sameDays([tx("2026-09-30", -100)], [tx("2026-08-31", -700)], "2026-09", on(2026, 11, 3));
    expect(r).toMatchObject({ cutDay: null, spent: 100, previousSpent: 700 });
  });

  it("flags a previous month with no data and counts it as 0", () => {
    const r = sameDays([tx("2026-11-02", -1000)], [], "2026-11", on(2026, 11, 8));
    expect(r).toMatchObject({ previousSpent: 0, noPrevious: true });
  });

  it("nets a refund off in each month, as the month totals do", () => {
    const r = sameDays(
      [tx("2026-11-02", -1000), tx("2026-11-03", 300)],
      [tx("2026-10-02", -500), tx("2026-10-04", 800)],
      "2026-11",
      on(2026, 11, 8),
    );
    expect(r.spent).toBe(700);
    expect(r.previousSpent).toBe(-300);
  });

  it("ignores Transfers and Income, and files no category as other", () => {
    const r = sameDays(
      [
        tx("2026-11-02", -1000, { type: "transfer", spendingCategory: null }),
        tx("2026-11-03", 5000, { type: "income", spendingCategory: null }),
        tx("2026-11-04", -200, { spendingCategory: null }),
      ],
      [],
      "2026-11",
      on(2026, 11, 8),
    );
    expect(r.spent).toBe(200);
    expect([...r.byCategory.keys()]).toEqual(["other"]);
  });

  it("lists a category spent only last month", () => {
    const r = sameDays([], [tx("2026-10-02", -400, { spendingCategory: "health" })], "2026-11", on(2026, 11, 8));
    expect(r.byCategory.get("health")).toEqual({ spent: 0, previousSpent: 400 });
  });
});

describe("categoryRows", () => {
  it("sorts by amount, lists last-month-only categories, drops empty ones and scales to the biggest of both", () => {
    const byCategory = new Map([
      ["groceries" as const, { spent: 5000, previousSpent: 9000 }],
      ["health" as const, { spent: 0, previousSpent: 300 }],
      ["leisure" as const, { spent: 7000, previousSpent: 0 }],
      ["pets" as const, { spent: 0, previousSpent: 0 }],
      ["other" as const, { spent: -200, previousSpent: 0 }],
    ]);
    const { rows, max } = categoryRows(byCategory);
    expect(rows.map((r) => r.category)).toEqual(["leisure", "groceries", "health", "other"]);
    expect(max).toBe(9000);
  });
});

describe("groupByDay", () => {
  it("groups by posted day, newest first, keeping the order within a day", () => {
    const days = groupByDay([tx("2026-11-02", -1), tx("2026-11-05", -2), tx("2026-11-02", -3)]);
    expect(days.map((d) => d.day)).toEqual(["2026-11-05", "2026-11-02"]);
    expect(days[1]!.transactions.map((t) => t.amountCents)).toEqual([-1, -3]);
  });
});

describe("uncategorised", () => {
  it("keeps the Expenses the server could not categorise", () => {
    const rows = [
      tx("2026-11-02", -1, { categorySetBy: "fallback" }),
      tx("2026-11-03", -2, { categorySetBy: "user" }),
      tx("2026-11-04", -3, { categorySetBy: null }),
      tx("2026-11-05", -4, { categorySetBy: "fallback", type: "transfer", spendingCategory: null }),
    ];
    expect(uncategorised(rows).map((t) => t.amountCents)).toEqual([-1]);
  });
});
