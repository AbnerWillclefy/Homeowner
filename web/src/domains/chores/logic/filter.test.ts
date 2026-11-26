import { describe, expect, it } from "vitest";
import { choreCategory } from "./choreCategory";
import { filterChores, normalizeText } from "./filter";

const CHORES = [
  { name: "Lavar louça", category: "kitchen" },
  { name: "Limpar o fogão", category: "kitchen" },
  { name: "Lavar a roupa", category: "laundry" },
  { name: "Varrer", category: "mystery" },
];
const names = (chores: { name: string }[]) => chores.map((c) => c.name);

describe("normalizeText", () => {
  it("drops accents and case", () => expect(normalizeText("LOUÇA ão")).toBe("louca ao"));
});

describe("filterChores", () => {
  it.each([
    ["lavar", ["Lavar louça", "Lavar a roupa"]],
    ["LAVAR", ["Lavar louça", "Lavar a roupa"]],
    ["louca", ["Lavar louça"]],
    ["fogao", ["Limpar o fogão"]],
    ["  fogão  ", ["Limpar o fogão"]],
    ["zzz", []],
  ])("finds %j by name regardless of case and accents", (query, expected) => {
    expect(names(filterChores(CHORES, query, null))).toEqual(expected);
  });

  it("keeps every Chore, in order, for an empty or blank query and no chip", () => {
    expect(filterChores(CHORES, "", null)).toEqual(CHORES);
    expect(filterChores(CHORES, "   ", null)).toEqual(CHORES);
  });

  it("combines the chip with the query", () => {
    expect(names(filterChores(CHORES, "", "kitchen"))).toEqual(["Lavar louça", "Limpar o fogão"]);
    expect(names(filterChores(CHORES, "lavar", "kitchen"))).toEqual(["Lavar louça"]);
    expect(filterChores(CHORES, "roupa", "kitchen")).toEqual([]);
  });

  it("can match the chip on the resolved Category, so an unknown one is under Other", () => {
    const resolved = (c: { category: string }) => choreCategory(c.category).id;
    expect(names(filterChores(CHORES, "", "other", resolved))).toEqual(["Varrer"]);
  });
});
