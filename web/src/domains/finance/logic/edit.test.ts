import { describe, expect, it } from "vitest";
import type { Transaction } from "../api/api";
import { editFor } from "./edit";

const tx: Transaction = {
  id: "t", postedOn: "2026-11-02", description: "x", sourceName: "N", amountCents: -1000, currency: "BRL",
  type: "expense", spendingCategory: "groceries", categorySetBy: "auto",
};

describe("editFor", () => {
  it("is null when nothing changed", () => {
    expect(editFor(tx, "expense", "groceries")).toBeNull();
    expect(editFor({ ...tx, type: "transfer", spendingCategory: null }, "transfer", "other")).toBeNull();
  });
  it("sends only the category for an Expense whose category changed", () => {
    expect(editFor(tx, "expense", "pets")).toEqual({ spendingCategory: "pets" });
  });
  it("sends only the type when it leaves Expense, whatever the picker still holds", () => {
    expect(editFor(tx, "transfer", "pets")).toEqual({ type: "transfer" });
  });
  it("sends the category with the type when it becomes an Expense", () => {
    expect(editFor({ ...tx, type: "income", spendingCategory: null }, "expense", "health")).toEqual({
      type: "expense",
      spendingCategory: "health",
    });
  });
});
