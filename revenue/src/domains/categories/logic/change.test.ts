import { describe, expect, it } from "vitest";
import type { History } from "../api";
import { changePercent, dayProgress, previousMonth } from "./change";
import { changedLimits } from "./limit";

const HISTORY: History = {
  months: [
    { month: "2029-12", spentCents: 150000, categories: [{ category: "groceries", spentCents: 150000 }] },
    { month: "2030-01", spentCents: 180000, categories: [{ category: "groceries", spentCents: 180000 }] },
  ],
};

describe("changePercent", () => {
  it("is the rounded change against the previous month", () => {
    expect(changePercent(180000, 150000)).toBe(20);
    expect(changePercent(96, 100)).toBe(-4);
    expect(changePercent(0, 100)).toBe(-100);
    expect(changePercent(100, 100)).toBe(0);
  });
  it("is null when the previous month spent nothing", () => {
    expect(changePercent(100, 0)).toBeNull();
    expect(changePercent(100, -50)).toBeNull();
  });
});

describe("previousMonth", () => {
  it("sums the month before and its categories", () => {
    expect(previousMonth(HISTORY, "2030-01")).toEqual({ month: "2029-12", total: 150000, byCategory: new Map([["groceries", 150000]]) });
  });
  it("is null when the history lacks it", () => {
    expect(previousMonth(undefined, "2030-01")).toBeNull();
    expect(previousMonth({ months: [] }, "2030-01")).toBeNull();
  });
});

describe("dayProgress", () => {
  it("is the São Paulo day of the month and the share of it gone", () => {
    expect(dayProgress("2030-01-10", "2030-01")).toEqual({ day: 10, days: 31, percent: 32 });
    expect(dayProgress("2030-02-28", "2030-02")).toEqual({ day: 28, days: 28, percent: 100 });
  });
});

describe("changedLimits", () => {
  const before = { groceries: 200000, pets: 10000 };
  it("lists only what differs: a new value, a removal, an addition", () => {
    const drafts = { groceries: 200000, pets: null, eating_out: 5000, health: null };
    expect(changedLimits(before, drafts)).toEqual([{ category: "pets", cents: null }, { category: "eating_out", cents: 5000 }]);
  });
  it("is empty when nothing changed", () => {
    expect(changedLimits(before, { groceries: 200000 })).toEqual([]);
  });
});
