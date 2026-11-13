import { describe, expect, it } from "vitest";
import { readIncome } from "./income";

describe("readIncome", () => {
  it("returns cents for an amount", () => expect(readIncome("5.000,00")).toEqual({ cents: 500000 }));
  it("names the problem", () => {
    expect(readIncome("  ")).toEqual({ problem: "empty" });
    expect(readIncome("0,00")).toEqual({ problem: "zero" });
    expect(readIncome("abc")).toEqual({ problem: "junk" });
  });
});
