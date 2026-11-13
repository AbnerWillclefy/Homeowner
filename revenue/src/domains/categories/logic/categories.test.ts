import { describe, expect, it } from "vitest";
import type { History, Spending } from "../api";
import { categoryHistory } from "./history";
import { isValidLimit, limitText, withLimit } from "./limit";
import { categoryOf } from "./route";
import { categoryRows } from "./rows";
import { ofCategory, uncategorised } from "./uncategorised";

const tx = (over: Partial<Spending["transactions"][number]>): Spending["transactions"][number] =>
  ({ id: "t", postedOn: "2030-01-05", description: "x", amountCents: -100, type: "expense", spendingCategory: "groceries", categorySetBy: "auto", ...over });

describe("limitText", () => {
  it("is under, at and over, with the gap never negative", () => {
    expect(limitText(1800, 2000)).toEqual({ key: "under", amount: 200 });
    expect(limitText(2000, 2000)).toEqual({ key: "at", amount: 0 });
    expect(limitText(2200, 2000)).toEqual({ key: "over", amount: 200 });
    expect(limitText(-500, 2000)).toEqual({ key: "under", amount: 2500 });
  });
});

describe("limits", () => {
  it("sets and removes one without touching the others", () => {
    expect(withLimit({ groceries: 1 }, "pets", 5)).toEqual({ groceries: 1, pets: 5 });
    expect(withLimit({ groceries: 1, pets: 5 }, "pets", null)).toEqual({ groceries: 1 });
  });
  it("takes only whole cents above zero", () => {
    expect([null, 0, -5, 10.5, 1].map(isValidLimit)).toEqual([false, false, false, false, true]);
  });
});

describe("categoryOf", () => {
  it("knows the ids and nothing else", () => {
    expect(categoryOf("eating_out")).toBe("eating_out");
    expect([undefined, "", "eating-out", "nope", "toString"].map(categoryOf)).toEqual([null, null, null, null, null]);
  });
});

describe("categoryRows", () => {
  it("lists what was spent or limited, biggest first", () => {
    const rows = categoryRows({ categories: [{ category: "pets", spentCents: 5 }, { category: "health", spentCents: 0 }, { category: "groceries", spentCents: 9 }], limits: { health: 100, housing: 1 } });
    expect(rows.map((r) => r.category)).toEqual(["groceries", "pets", "health", "housing"]);
  });
});

describe("rows of a month", () => {
  it("finds the uncategorised expenses by the fallback mark", () => {
    const rows = [tx({ id: "a" }), tx({ id: "b", spendingCategory: "other", categorySetBy: "fallback" }), tx({ id: "c", spendingCategory: "other", categorySetBy: "user" }), tx({ id: "d", type: "income", categorySetBy: "fallback" })];
    expect(uncategorised(rows).map((r) => r.id)).toEqual(["b"]);
  });
  it("takes one category's expenses newest first", () => {
    const rows = [tx({ id: "a", postedOn: "2030-01-02" }), tx({ id: "b", postedOn: "2030-01-09" }), tx({ id: "c", spendingCategory: "pets" }), tx({ id: "d", type: "income" })];
    expect(ofCategory(rows, "groceries").map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("categoryHistory", () => {
  const history: History = { months: [{ month: "2029-12", spentCents: 5, categories: [{ category: "pets", spentCents: 5 }] }, { month: "2030-01", spentCents: 0, categories: [] }] };
  it("gives zero for a month without the category, and says when all are zero", () => {
    expect(categoryHistory(history, "pets")).toEqual({ months: [{ month: "2029-12", cents: 5 }, { month: "2030-01", cents: 0 }], allZero: false });
    expect(categoryHistory(history, "health").allZero).toBe(true);
  });
});
