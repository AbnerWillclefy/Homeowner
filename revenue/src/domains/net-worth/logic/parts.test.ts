import { describe, expect, it } from "vitest";
import { partWidths, seriesChange } from "./parts";

const today = (balancesCents: number, investmentsCents: number, cardBillsCents: number) => ({ totalCents: 0, balancesCents, investmentsCents, cardBillsCents });

describe("partWidths", () => {
  it("shares 100 over the absolute sum, in the order Investments, Accounts, Card bills", () => {
    expect(partWidths(today(1500, 7900, 600))).toEqual([79, 15, 6]);
  });
  it("counts a negative balance by its size", () => {
    expect(partWidths(today(-2500, 5000, 2500))).toEqual([50, 25, 25]);
  });
  it("is zero everywhere when every part is zero", () => {
    expect(partWidths(today(0, 0, 0))).toEqual([0, 0, 0]);
  });
});

describe("seriesChange", () => {
  const s = (...cents: number[]) => cents.map((c, i) => ({ day: `2030-01-0${i + 1}`, cents: c }));
  it("is the last point minus the first, and a percent of the first", () => {
    expect(seriesChange(s(100_000, 102_500))).toEqual({ cents: 2500, percent: 2.5 });
  });
  it("has no percent when the first point is zero or below", () => {
    expect(seriesChange(s(0, 500))).toEqual({ cents: 500, percent: null });
    expect(seriesChange(s(-100, 500))).toEqual({ cents: 600, percent: null });
  });
  it("is null for fewer than two points", () => {
    expect(seriesChange(s(100))).toBeNull();
    expect(seriesChange([])).toBeNull();
  });
});
