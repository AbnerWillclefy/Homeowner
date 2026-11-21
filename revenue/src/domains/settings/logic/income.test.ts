import { describe, expect, it } from "vitest";
import { readIncome } from "./income";

describe("readIncome", () => {
  it("accepts a positive amount up to the maximum", () => {
    expect(readIncome(500000)).toEqual({ cents: 500000 });
    expect(readIncome(1_000_000_000_000)).toEqual({ cents: 1_000_000_000_000 });
  });
  it.each([
    [null, "empty"],
    [0, "zero"],
    [-1, "junk"],
    [1_000_000_000_001, "junk"],
  ])("refuses %s as %s", (cents, problem) => expect(readIncome(cents)).toEqual({ problem }));
});
