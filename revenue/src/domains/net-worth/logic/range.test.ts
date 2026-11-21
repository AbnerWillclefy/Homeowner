import { describe, expect, it } from "vitest";
import { rangeFromParam, startsLate } from "./range";

describe("rangeFromParam", () => {
  it("keeps the three ranges and falls back to 30 days", () => {
    expect(["30d", "90d", "1y", "7d", null, ""].map(rangeFromParam)).toEqual(["30d", "90d", "1y", "30d", "30d", "30d"]);
  });
});

describe("startsLate", () => {
  const days = (n: number) => Array.from({ length: n }, (_, i) => ({ day: `d${i}`, cents: i }));
  it("is true when the series has fewer points than the range has days", () => {
    expect(startsLate(days(29), "30d")).toBe(true);
    expect(startsLate(days(30), "30d")).toBe(false);
    expect(startsLate(days(364), "1y")).toBe(true);
    expect(startsLate(days(365), "1y")).toBe(false);
  });
});
