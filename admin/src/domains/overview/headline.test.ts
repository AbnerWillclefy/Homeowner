import { describe, expect, it } from "vitest";
import {
  armRates,
  costPerLlmRun,
  explanationShare,
  fallbackShare,
  ratioSeries,
  refereeRate,
  sampledRateDelta,
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

describe("armRates", () => {
  it("gives the completion and refuse rate of the proposed Tasks", () => {
    expect(armRates({ proposed: 40, completed: 30, refused: 10 })).toEqual({ n: 40, completion: 0.75, refuse: 0.25 });
  });

  it("needs exactly 20 proposed Tasks: 19 is not enough data, 20 gives rates", () => {
    expect(armRates({ proposed: 19, completed: 19, refused: 0 })).toBe("not-enough-data");
    expect(armRates({ proposed: 20, completed: 10, refused: 0 })).toEqual({ n: 20, completion: 0.5, refuse: 0 });
  });

  it("is not enough data with nothing proposed, never NaN", () => {
    expect(armRates(zeroArm)).toBe("not-enough-data");
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
