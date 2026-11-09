import { describe, expect, it } from "vitest";
import { readIncome } from "./income";
import { limitText, withLimit } from "./limit";

describe("limitText", () => {
  it("says how far under", () => expect(limitText(68000, 80000)).toEqual({ key: "under", amount: 12000 }));
  it("says how far over", () => expect(limitText(86000, 80000)).toEqual({ key: "over", amount: 6000 }));
  it("says at the limit", () => expect(limitText(80000, 80000)).toEqual({ key: "at", amount: 0 }));
  it("counts a refund-heavy category as under by the full gap", () => expect(limitText(-5000, 80000)).toEqual({ key: "under", amount: 85000 }));
});

describe("withLimit", () => {
  it("sets and changes without touching the input", () => {
    const before = { groceries: 1000 };
    expect(withLimit(before, "leisure", 500)).toEqual({ groceries: 1000, leisure: 500 });
    expect(withLimit(before, "groceries", 2000)).toEqual({ groceries: 2000 });
    expect(before).toEqual({ groceries: 1000 });
  });
  it("removes on null", () => expect(withLimit({ groceries: 1000, leisure: 5 }, "groceries", null)).toEqual({ leisure: 5 }));
});

// The limit field reads its input with the income rules.
describe("limit input", () => {
  it("rejects empty, zero, negative and junk", () => {
    expect(readIncome("")).toEqual({ problem: "empty" });
    expect(readIncome("0")).toEqual({ problem: "zero" });
    expect(readIncome("-50")).toEqual({ problem: "junk" });
    expect(readIncome("abc")).toEqual({ problem: "junk" });
  });
  it("reads an amount", () => expect(readIncome("800,00")).toEqual({ cents: 80000 }));
});
