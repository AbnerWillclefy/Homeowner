import { describe, expect, it } from "vitest";
import type { CommitmentMonth } from "../api/api";
import { committedBars } from "./committedBars";

const month = (m: string, committedCents: number, bills: number[], installments: number[]): CommitmentMonth => ({
  month: m,
  committedCents,
  bills: bills.map((expectedCents, i) => ({ id: `b${i}`, name: `b${i}`, expectedCents })),
  installments: installments.map((amountCents, i) => ({ name: `p${i}`, number: 1, total: 2, amountCents })),
});

describe("committedBars", () => {
  it("splits each month into Bills and installments, and totals them", () => {
    expect(committedBars([month("2030-01", 87000, [12000, 5000], [45000, 25000])])).toEqual([
      { month: "2030-01", bills: 17000, installments: 70000, total: 87000 },
    ]);
  });

  it("skips a month with nothing committed and keeps the order", () => {
    const bars = committedBars([month("2030-01", 0, [], []), month("2030-02", 100, [100], []), month("2030-03", 200, [], [200])]);
    expect(bars.map((b) => b.month)).toEqual(["2030-02", "2030-03"]);
  });
});
