import { describe, expect, it } from "vitest";
import type { Transaction } from "../api";
import { tagOf } from "./categories";
import { editFor, noteTooLong } from "./edit";
import { filterRows, isFiltered, matchesQuery, NO_FILTER } from "./filter";
import { groupByDay, sourceCount, totalsOf } from "./totals";

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: "t", postedOn: "2030-01-05", countsOn: "2030-01-05", description: "x", sourceName: "Nu", amountCents: -100,
  type: "expense", spendingCategory: "groceries", installment: null, note: null, ...over,
});

describe("editFor", () => {
  it("is null when nothing changed", () => {
    expect(editFor(tx(), "expense", "groceries", "")).toBeNull();
  });
  it("sends the category alone when only it changed", () => {
    expect(editFor(tx(), "expense", "pets", "")).toEqual({ spendingCategory: "pets" });
  });
  it("sends the type, and no category, for a non-expense", () => {
    expect(editFor(tx(), "saving", "pets", "")).toEqual({ type: "saving" });
  });
  it("sends a category with the type when becoming an expense", () => {
    expect(editFor(tx({ type: "income", spendingCategory: null }), "expense", "other", "")).toEqual({ type: "expense", spendingCategory: "other" });
  });
});

describe("editFor with a Note", () => {
  it("sends a changed Note, trimmed", () => expect(editFor(tx(), "expense", "groceries", "  Fone ")).toEqual({ note: "Fone" }));
  it("turns a pasted tab into a space, so the server never sees a control character", () =>
    expect(editFor(tx(), "expense", "groceries", "Fone\tBluetooth")).toEqual({ note: "Fone Bluetooth" }));
  it("sends \"\" to clear it", () => expect(editFor(tx({ note: "Fone" }), "expense", "groceries", "")).toEqual({ note: "" }));
  it("sends nothing when only whitespace changed", () => {
    expect(editFor(tx({ note: "Fone" }), "expense", "groceries", " Fone  ")).toBeNull();
    expect(editFor(tx(), "expense", "groceries", "   ")).toBeNull();
  });
  it("sends a Note-only edit on a non-Expense, with no category", () =>
    expect(editFor(tx({ type: "income", spendingCategory: null }), "income", "other", "Bônus")).toEqual({ note: "Bônus" }));
});

describe("noteTooLong", () => {
  it("counts code points: 200 emoji pass and 201 fail", () => {
    expect(noteTooLong("😀".repeat(200))).toBe(false);
    expect(noteTooLong("😀".repeat(201))).toBe(true);
  });
  it("ignores surrounding whitespace", () => expect(noteTooLong(` ${"x".repeat(200)} `)).toBe(false));
});

describe("filterRows", () => {
  const rows = [tx({ id: "a" }), tx({ id: "b", spendingCategory: "pets" }), tx({ id: "c", type: "income", spendingCategory: null }), tx({ id: "d", spendingCategory: null })];
  const ids = (r: Transaction[]) => r.map((t) => t.id);
  it("keeps everything with no filter", () => expect(ids(filterRows(rows, NO_FILTER))).toEqual(["a", "b", "c", "d"]));
  it("filters by type", () => expect(ids(filterRows(rows, { ...NO_FILTER, type: "income" }))).toEqual(["c"]));
  it("filters by category, an uncategorised expense being Other", () => {
    expect(ids(filterRows(rows, { ...NO_FILTER, category: "pets" }))).toEqual(["b"]);
    expect(ids(filterRows(rows, { ...NO_FILTER, category: "other" }))).toEqual(["d"]);
  });
  it("keeps only uncategorised Expenses for Revisar, not Income", () => {
    expect(ids(filterRows(rows, { ...NO_FILTER, uncategorised: true }))).toEqual(["d"]);
  });
  it("says whether any filter is on", () => {
    expect(isFiltered(NO_FILTER)).toBe(false);
    expect(isFiltered({ ...NO_FILTER, query: "  " })).toBe(false);
    expect(isFiltered({ ...NO_FILTER, query: "a" })).toBe(true);
    expect(isFiltered({ ...NO_FILTER, uncategorised: true })).toBe(true);
  });
});

describe("matchesQuery", () => {
  const cafe = tx({ description: "Café Pelé", sourceName: "Nubank crédito", amountCents: -123456 });
  it("ignores case and accents, both ways", () => {
    expect(matchesQuery(cafe, "cafe")).toBe(true);
    expect(matchesQuery(cafe, "PELÉ")).toBe(true);
    expect(matchesQuery(tx({ description: "Cafe" }), "café")).toBe(true);
  });
  it("finds the Note ignoring accents, and a null Note does not throw", () => {
    expect(matchesQuery(tx({ description: "AMAZON", note: "Fône" }), "fone")).toBe(true);
    expect(matchesQuery(tx({ description: "AMAZON", note: null }), "fone")).toBe(false);
  });
  it("finds the Source name", () => expect(matchesQuery(cafe, "nubank")).toBe(true));
  it("reads an amount typed with or without separators", () => {
    for (const typed of ["1.234,56", "1234,56", "1234.56", "123456"]) expect(matchesQuery(cafe, typed)).toBe(true);
    expect(matchesQuery(cafe, "1.234,57")).toBe(false);
  });
  it("matches an income's amount by its size, not its sign", () => expect(matchesQuery(tx({ amountCents: 500000 }), "5.000")).toBe(true));
  it("does not match every row on a lone separator", () => {
    for (const typed of [",", ".", ",,"]) expect(matchesQuery(cafe, typed)).toBe(false);
  });
  it("does not read digits inside words as an amount", () => expect(matchesQuery(cafe, "loja 99")).toBe(false));
  it("keeps everything for an empty query", () => expect(matchesQuery(cafe, "  ")).toBe(true));
});

describe("totalsOf", () => {
  const rows = [
    tx({ id: "a", amountCents: -10000 }),
    tx({ id: "refund", amountCents: 2000 }),
    tx({ id: "u", amountCents: -500, spendingCategory: null }),
    tx({ id: "i", type: "income", amountCents: 900000, spendingCategory: null }),
    tx({ id: "s", type: "saving", amountCents: -60000, spendingCategory: null }),
  ];
  it("sums Expenses as what they cost, a refund coming off", () => expect(totalsOf(rows).spentCents).toBe(8500));
  it("sums Income and counts uncategorised Expenses only", () => {
    expect(totalsOf(rows).incomeCents).toBe(900000);
    expect(totalsOf(rows).uncategorised).toBe(1);
  });
});

describe("groupByDay", () => {
  it("groups by posting day, newest first", () => {
    const groups = groupByDay([tx({ id: "a", postedOn: "2030-01-05" }), tx({ id: "b", postedOn: "2030-01-07" }), tx({ id: "c", postedOn: "2030-01-05" })]);
    expect(groups.map((g) => [g.day, g.rows.map((r) => r.id)])).toEqual([["2030-01-07", ["b"]], ["2030-01-05", ["a", "c"]]]);
  });
  it("counts Sources", () => expect(sourceCount([tx({ sourceName: "A" }), tx({ sourceName: "A" }), tx({ sourceName: "B" })])).toBe(2));
});

describe("tagOf", () => {
  it("maps the API ids to Bedrock's, and no category to other", () => {
    expect(tagOf("household_bills")).toBe("household-bills");
    expect(tagOf(null)).toBe("other");
  });
});
