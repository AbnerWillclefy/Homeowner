import { describe, expect, it } from "vitest";
import type { Transaction } from "../api";
import { tagOf } from "./categories";
import { editFor } from "./edit";
import { filterRows } from "./filter";
import { addMonths, monthFromParam, monthLabel } from "./month";

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: "t", postedOn: "2030-01-05", countsOn: "2030-01-05", description: "x", sourceName: "Nu", amountCents: -100,
  type: "expense", spendingCategory: "groceries", installment: null, ...over,
});

describe("editFor", () => {
  it("is null when nothing changed", () => {
    expect(editFor(tx(), "expense", "groceries")).toBeNull();
  });
  it("sends the category alone when only it changed", () => {
    expect(editFor(tx(), "expense", "pets")).toEqual({ spendingCategory: "pets" });
  });
  it("sends the type, and no category, for a non-expense", () => {
    expect(editFor(tx(), "saving", "pets")).toEqual({ type: "saving" });
  });
  it("sends a category with the type when becoming an expense", () => {
    expect(editFor(tx({ type: "income", spendingCategory: null }), "expense", "other")).toEqual({ type: "expense", spendingCategory: "other" });
  });
});

describe("filterRows", () => {
  const rows = [tx({ id: "a" }), tx({ id: "b", spendingCategory: "pets" }), tx({ id: "c", type: "income", spendingCategory: null }), tx({ id: "d", spendingCategory: null })];
  const ids = (r: Transaction[]) => r.map((t) => t.id);
  it("keeps everything with no filter", () => expect(ids(filterRows(rows, { type: "all", category: "all" }))).toEqual(["a", "b", "c", "d"]));
  it("filters by type", () => expect(ids(filterRows(rows, { type: "income", category: "all" }))).toEqual(["c"]));
  it("filters by category, an uncategorised expense being Other", () => {
    expect(ids(filterRows(rows, { type: "all", category: "pets" }))).toEqual(["b"]);
    expect(ids(filterRows(rows, { type: "all", category: "other" }))).toEqual(["d"]);
  });
});

describe("month", () => {
  it("moves across a year", () => {
    expect(addMonths("2030-01", -1)).toBe("2029-12");
    expect(addMonths("2029-12", 1)).toBe("2030-01");
  });
  it("takes a real month up to this one, else this one", () => {
    expect(monthFromParam("2030-01", "2030-03")).toBe("2030-01");
    expect(monthFromParam("2030-04", "2030-03")).toBe("2030-03");
    expect(monthFromParam("2030-13", "2030-03")).toBe("2030-03");
    expect(monthFromParam(null, "2030-03")).toBe("2030-03");
  });
  it("capitalises the label", () => expect(monthLabel("2030-01", "pt-BR")).toBe("Janeiro de 2030"));
});

describe("tagOf", () => {
  it("maps the API ids to Bedrock's, and no category to other", () => {
    expect(tagOf("household_bills")).toBe("household-bills");
    expect(tagOf(null)).toBe("other");
  });
});
