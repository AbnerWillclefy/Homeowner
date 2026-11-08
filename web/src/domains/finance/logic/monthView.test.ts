import { describe, expect, it } from "vitest";
import type { MonthResponse, Transaction } from "../api/api";
import { monthView, spent } from "./monthView";

const tx = (over: Partial<Transaction>): Transaction => ({
  id: "t", postedOn: "2026-11-02", description: "x", sourceName: "Nubank", amountCents: -1000, currency: "BRL",
  type: "expense", spendingCategory: "other", categorySetBy: "auto", ...over,
});

describe("spent", () => {
  it("is the negated amount, so a refund is negative", () => {
    expect(spent(tx({ amountCents: -2500 }))).toBe(2500);
    expect(spent(tx({ amountCents: 900 }))).toBe(-900);
  });
});

describe("monthView", () => {
  const response: MonthResponse = {
    month: "2026-11",
    spentCents: 4200,
    categories: [],
    transactions: [
      tx({ id: "a", amountCents: -1000, spendingCategory: "groceries" }),
      tx({ id: "b", amountCents: -3500, spendingCategory: "leisure" }),
      tx({ id: "c", amountCents: 500, spendingCategory: "groceries" }),
      tx({ id: "d", amountCents: -9000, type: "transfer", spendingCategory: null }),
      tx({ id: "e", amountCents: 20000, type: "income", spendingCategory: null }),
      tx({ id: "f", amountCents: -700, spendingCategory: null }),
    ],
  };

  it("groups expenses by category, biggest spend first, a refund netting off", () => {
    const view = monthView(response);
    expect(view.categories.map((c) => [c.category, c.spentCents, c.transactions.map((t) => t.id)])).toEqual([
      ["leisure", 3500, ["b"]],
      ["other", 700, ["f"]],
      ["groceries", 500, ["a", "c"]],
    ]);
  });
  it("keeps transfers and income apart and takes the total from the API", () => {
    const view = monthView(response);
    expect(view.transfers.map((t) => t.id)).toEqual(["d"]);
    expect(view.income.map((t) => t.id)).toEqual(["e"]);
    expect(view.spentCents).toBe(4200);
  });
  it("is empty for a month with nothing", () => {
    expect(monthView({ month: "2026-11", spentCents: 0, categories: [], transactions: [] }).isEmpty).toBe(true);
    expect(monthView(response).isEmpty).toBe(false);
  });
});
