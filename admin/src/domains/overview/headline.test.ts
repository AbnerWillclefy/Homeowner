import { describe, expect, it } from "vitest";
import {
  costDelta,
  costPerLlmRun,
  explanationShare,
  fallbackShare,
  hasEnoughData,
  hasWorthData,
  ratioSeries,
  refereeRate,
  sampledRateDelta,
  seriesLabel,
} from "./headline";
import type { WorthCounts, WorthReliability } from "./worth";

const zeroArm = { proposed: 0, completed: 0, refused: 0 };

function reliability(over: Partial<WorthReliability> = {}): WorthReliability {
  return { runsLlm: 0, runsFallback: 0, runsLlmNotAsked: 0, allocatorCalls: 0, refereeRejected: 0, ...over };
}

function counts(over: Partial<WorthCounts> = {}): WorthCounts {
  return {
    outcome: { llm: zeroArm, baseline: zeroArm },
    reliability: reliability(),
    cost: { allocatorCostMicros: 0, uncostedCalls: 0 },
    explanations: { llm: 0, template: 0 },
    ...over,
  };
}

describe("hasEnoughData", () => {
  it("needs exactly 20 proposed Tasks: 19 is not enough data, 20 is", () => {
    expect(hasEnoughData({ proposed: 19, completed: 19, refused: 0 })).toBe(false);
    expect(hasEnoughData({ proposed: 20, completed: 10, refused: 0 })).toBe(true);
  });

  it("is not enough data with nothing proposed", () => {
    expect(hasEnoughData(zeroArm)).toBe(false);
  });
});

describe("fallbackShare", () => {
  it("is fallbacks over LLM-planned plus fallen back, and leaves out the runs where the LLM was not asked", () => {
    expect(fallbackShare(reliability({ runsLlm: 6, runsFallback: 2, runsLlmNotAsked: 50 }))).toEqual({ part: 2, whole: 8 });
  });
});

describe("refereeRate", () => {
  it("is rejections over allocator calls", () => {
    expect(refereeRate(reliability({ refereeRejected: 3, allocatorCalls: 12 }))).toEqual({ part: 3, whole: 12 });
  });
});

describe("costPerLlmRun", () => {
  it("divides the allocator cost by the LLM-planned runs", () => {
    expect(costPerLlmRun(counts({ cost: { allocatorCostMicros: 9000, uncostedCalls: 0 }, reliability: reliability({ runsLlm: 3 }) }))).toBe(3000);
  });

  it("is null (n/a) when no run was planned by the LLM", () => {
    expect(costPerLlmRun(counts({ cost: { allocatorCostMicros: 9000, uncostedCalls: 0 } }))).toBeNull();
  });
});

describe("costDelta", () => {
  const withRuns = (runsLlm: number, allocatorCostMicros: number) =>
    counts({ cost: { allocatorCostMicros, uncostedCalls: 0 }, reliability: reliability({ runsLlm }) });

  it("compares the cost per run of two windows with enough runs", () => {
    expect(costDelta(withRuns(20, 400_000), withRuns(20, 200_000))).toEqual({ type: "percent", change: 100 });
  });

  it("is none without a previous window or with fewer than 20 runs in either", () => {
    expect(costDelta(withRuns(20, 400_000), undefined)).toEqual({ type: "none" });
    expect(costDelta(withRuns(1, 400_000), withRuns(40, 200_000))).toEqual({ type: "none" });
    expect(costDelta(withRuns(40, 400_000), withRuns(19, 200_000))).toEqual({ type: "none" });
  });
});

describe("explanationShare", () => {
  it("is LLM over LLM plus template", () => {
    expect(explanationShare({ llm: 1, template: 3 })).toEqual({ part: 1, whole: 4 });
  });
});

describe("ratioSeries", () => {
  it("gives a whole percent per day and null on a day whose denominator is 0", () => {
    const days = [
      counts({ explanations: { llm: 1, template: 3 } }),
      counts(),
      counts({ explanations: { llm: 2, template: 0 } }),
    ];
    const series = ratioSeries(days, (d) => explanationShare(d.explanations));
    expect(series).toEqual([25, null, 100]);
    expect(series.some((v) => Number.isNaN(v))).toBe(false);
  });
});

describe("sampledRateDelta", () => {
  it("shows no delta when the previous window is under the sample size", () => {
    expect(sampledRateDelta({ part: 15, whole: 30 }, { part: 1, whole: 2 }, 20)).toEqual({ type: "none" });
  });

  it("shows no delta when the current window is under the sample size", () => {
    expect(sampledRateDelta({ part: 1, whole: 2 }, { part: 15, whole: 30 }, 20)).toEqual({ type: "none" });
  });

  it("shows points when both windows are big enough, and none without a previous window", () => {
    expect(sampledRateDelta({ part: 15, whole: 20 }, { part: 10, whole: 20 }, 20)).toEqual({ type: "points", change: 25 });
    expect(sampledRateDelta({ part: 15, whole: 20 }, undefined, 20)).toEqual({ type: "none" });
  });
});

describe("hasWorthData", () => {
  it("is false for all zeros and true as soon as anything was counted", () => {
    expect(hasWorthData(counts())).toBe(false);
    expect(hasWorthData(counts({ explanations: { llm: 1, template: 0 } }))).toBe(true);
    expect(hasWorthData(counts({ reliability: reliability({ runsLlmNotAsked: 2 }) }))).toBe(true);
  });
});

describe("seriesLabel", () => {
  it("describes the first, last and highest day, and says when there is no data", () => {
    expect(seriesLabel("Share", [10, null, 30, 20])).toBe("Share, per day, last 4 days: 10% to 20%, highest 30%");
    expect(seriesLabel("Share", [null, null])).toBe("Share, per day, last 2 days: no data");
  });

  it("formats with a given function, for money", () => {
    expect(seriesLabel("Cost", [1000, 3000], (v) => `${v} micros`)).toBe(
      "Cost, per day, last 2 days: 1000 micros to 3000 micros, highest 3000 micros",
    );
  });
});
