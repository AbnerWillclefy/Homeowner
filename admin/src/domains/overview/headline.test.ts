import { describe, expect, it } from "vitest";
import type { Overview, OverviewDay } from "./api";
import { fallbackHeadline } from "./headline";

function day(n: number, runs: number, fallbacks: number): OverviewDay {
  return {
    date: `2026-10-${String(n).padStart(2, "0")}`,
    runs, rejected: 0, fallbacks, checkins: 0, completions: 0, refuses: 0, takes: 0, swapsAccepted: 0,
    pushes: { delivered: 0, failed: 0, gone: 0, unknown: 0 },
  };
}

const overview = (days: OverviewDay[], previous?: Overview["previous"]): Overview => ({
  range: "7d", from: days[0]!.date, to: days.at(-1)!.date,
  totals: { users: 0, homes: 0, residents: 0, chores: 0 }, active: { homes: 0, residents: 0 }, days, previous,
});

describe("fallbackHeadline", () => {
  it("sums fallbacks and runs over the range and shows the share as a whole percent", () => {
    const h = fallbackHeadline(overview([day(1, 10, 1), day(2, 10, 3)]));
    expect(h.fallbacks).toBe(4);
    expect(h.runs).toBe(20);
    expect(h.value).toBe("20%");
  });

  it("builds the per-day series, with null for a day without runs", () => {
    const h = fallbackHeadline(overview([day(1, 10, 1), day(2, 0, 0), day(3, 4, 4)]));
    expect(h.series).toEqual([10, null, 100]);
  });

  it("describes the series for a screen reader", () => {
    const h = fallbackHeadline(overview([day(1, 10, 1), day(2, 0, 0), day(3, 4, 2)]));
    expect(h.label).toBe("Fallbacks per run, per day, last 3 days: 10% to 50%, highest 50%");
  });

  it("says n/a and has no range in the label when there are no runs", () => {
    const h = fallbackHeadline(overview([day(1, 0, 0), day(2, 0, 0)]));
    expect(h.value).toBe("n/a");
    expect(h.series).toEqual([null, null]);
    expect(h.label).toBe("Fallbacks per run, per day, last 2 days: no runs");
  });

  it("compares with the previous block, or shows no delta without one", () => {
    const previous = { from: "a", to: "b", active: { homes: 0, residents: 0 }, ...day(1, 100, 10) } as Overview["previous"];
    const withPrev = fallbackHeadline(overview([day(1, 10, 3)], previous));
    expect(withPrev.delta).toEqual({ type: "points", change: 20 });
    expect(fallbackHeadline(overview([day(1, 10, 3)])).delta).toEqual({ type: "none" });
  });
});
