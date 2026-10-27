import { describe, expect, it } from "vitest";
import type { AiDay, AiUsage, Outcomes, ServiceDay } from "./api";
import { aiHeadline, callsOf } from "./headline";

type Part = Partial<Omit<ServiceDay, "outcomes">> & { outcomes?: Partial<Outcomes> };

function service(over: Part = {}): ServiceDay {
  const { outcomes, ...rest } = over;
  return {
    outcomes: { accepted: 0, rejected_by_referee: 0, invalid_response: 0, timeout: 0, error: 0, skipped_cap: 0, skipped_budget: 0, ...outcomes },
    latencyP50Ms: null,
    latencyMaxMs: null,
    inputTokens: 0,
    outputTokens: 0,
    estCostMicros: 0,
    uncostedCalls: 0,
    ...rest,
  };
}

const day = (n: number, allocator: Part = {}, explainer: Part = {}): AiDay => ({
  date: `2026-10-${String(n).padStart(2, "0")}`,
  services: { allocator: service(allocator), explainer: service(explainer) },
});

const shares = {
  allocatorShare: { llm: 0, baseline: 0 },
  explanationShare: {
    llm: 0,
    template: 0,
    templateReasons: { rejected_by_referee: 0, invalid_response: 0, timeout: 0, error: 0, skipped_cap: 0, skipped_budget: 0, partial: 0, notAsked: 0 },
  },
};

const usage = (days: AiDay[], previous?: { allocator?: Part; explainer?: Part }): AiUsage => ({
  range: "7d",
  from: days[0]!.date,
  to: days.at(-1)!.date,
  costIsEstimate: true,
  days,
  monthToDate: { month: "2026-10", estCostMicros: 0, uncostedCalls: 0, limitMicros: null },
  dailyCapPerHome: 3,
  ...shares,
  topViolationKinds: [],
  topFallbackReasons: [],
  previous: previous && {
    from: "2026-09-24",
    to: "2026-09-30",
    services: { allocator: service(previous.allocator), explainer: service(previous.explainer) },
    ...shares,
  },
});

describe("callsOf", () => {
  it("counts the non-skip outcomes", () => {
    const outcomes = { accepted: 1, rejected_by_referee: 2, invalid_response: 3, timeout: 4, error: 5, skipped_cap: 6, skipped_budget: 7 };
    expect(callsOf(service({ outcomes }))).toBe(15);
  });
});

describe("aiHeadline", () => {
  const days = [
    day(1, { outcomes: { accepted: 8, rejected_by_referee: 2 } }, { outcomes: { accepted: 5 } }),
    day(2, { outcomes: { accepted: 6, timeout: 2, skipped_cap: 2 } }, { outcomes: { error: 1, skipped_budget: 1 } }),
  ];

  it("totals calls over both services and keeps the per-day series", () => {
    const h = aiHeadline(usage(days));
    expect(h.calls.value).toBe(24);
    expect(h.calls.series).toEqual([15, 9]);
    expect(h.calls.label).toBe("Total LLM calls, per day, last 2 days: 15 to 9, highest 15");
  });

  it("shares failures (timeout, error, cap skip) over all attempts of both services", () => {
    const h = aiHeadline(usage(days));
    expect(h.failure.part).toBe(5);
    expect(h.failure.whole).toBe(27);
    expect(h.failure.value).toBe("19%");
    expect(h.failure.series).toEqual([0, 42]);
  });

  it("counts a day of only skips as a 100% failure share with no calls", () => {
    const h = aiHeadline(usage([day(1, { outcomes: { skipped_cap: 3 } })]));
    expect(h.calls.value).toBe(0);
    expect(h.failure.value).toBe("100%");
    expect(h.failure.series).toEqual([100]);
  });

  it("is neutral below the minimum sample of allocator calls", () => {
    const h = aiHeadline(usage([day(1, { outcomes: { accepted: 11, rejected_by_referee: 8 } })]));
    expect(h.referee.status).toEqual({ state: "neutral", label: "Not enough data" });
  });

  it("judges the referee rate at the minimum sample", () => {
    const h = aiHeadline(usage([day(1, { outcomes: { accepted: 16, rejected_by_referee: 4 } })]));
    expect(h.referee.value).toBe("20%");
    expect(h.referee.status).toEqual({ state: "warn", label: "Rejections elevated" });
  });

  it("uses only the allocator for the referee rate", () => {
    const h = aiHeadline(usage([day(1, { outcomes: { accepted: 20 } }, { outcomes: { rejected_by_referee: 20 } })]));
    expect(h.referee.value).toBe("0%");
    expect(h.referee.status.state).toBe("ok");
  });

  it("keeps allocator and explainer cost apart, with uncosted calls", () => {
    const h = aiHeadline(
      usage([day(1, { estCostMicros: 3_000, uncostedCalls: 1 }, { estCostMicros: 500 }), day(2, { estCostMicros: 2_000 }, { estCostMicros: 700 })]),
    );
    expect(h.cost.allocator.micros).toBe(5_000);
    expect(h.cost.allocator.uncosted).toBe(1);
    expect(h.cost.allocator.series).toEqual([3_000, 2_000]);
    expect(h.cost.explainer.micros).toBe(1_200);
    expect(h.cost.explainer.uncosted).toBe(0);
    expect(h.cost.explainer.series).toEqual([500, 700]);
  });

  it("has no NaN for an all-zero fixture", () => {
    const h = aiHeadline(usage([day(1), day(2)], {}));
    expect(h.calls.value).toBe(0);
    expect(h.failure.value).toBe("n/a");
    expect(h.failure.series).toEqual([null, null]);
    expect(h.failure.label).toBe("Failure share, per day, last 2 days: no attempts");
    expect(h.referee.value).toBe("n/a");
    expect(h.referee.series).toEqual([null, null]);
    expect(h.failure.delta).toEqual({ type: "none" });
    expect(JSON.stringify(h)).not.toContain("NaN");
  });

  it("compares with the previous window", () => {
    const h = aiHeadline(
      usage(days, {
        allocator: { outcomes: { accepted: 20, timeout: 10 }, estCostMicros: 1_000_000 },
        explainer: { outcomes: { accepted: 20 } },
      }),
    );
    expect(h.calls.delta).toEqual({ type: "percent", change: -52 });
    expect(h.failure.delta).toEqual({ type: "points", change: -1 });
    expect(h.cost.allocator.delta).toEqual({ type: "percent", change: -100 });
    expect(h.cost.explainer.delta).toEqual({ type: "same" });
  });

  it("gives no delta when previous is missing", () => {
    const h = aiHeadline(usage(days));
    for (const d of [h.calls.delta, h.failure.delta, h.referee.delta, h.cost.allocator.delta, h.cost.explainer.delta]) {
      expect(d).toEqual({ type: "none" });
    }
  });
});
