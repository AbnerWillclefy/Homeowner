import { describe, expect, it } from "vitest";
import type { DayPlan, DayPlanResult } from "../api/api";
import {
  isReplanBusy,
  replanReducer,
  replanStatusKey,
  runIdOf,
  type ReplanEvent,
  type ReplanState,
} from "./replan";

const IDLE: ReplanState = { kind: "idle" };
const TIMEOUT = 90_000;

function plan(extra: Partial<DayPlan> = {}): DayPlan {
  return {
    date: "2026-10-11",
    allocationTime: "07:00",
    planned: true,
    rejected: false,
    allocator: "baseline",
    energy: 5,
    mine: [],
    others: [],
    pool: [],
    doneToday: [],
    ...extra,
  };
}
const ok = (extra: Partial<DayPlan> = {}): DayPlanResult => ({ kind: "ok", plan: plan(extra) });

function run(events: ReplanEvent[], from: ReplanState = IDLE): ReplanState {
  return events.reduce((state, event) => replanReducer(state, event, TIMEOUT), from);
}

const PRESS: ReplanEvent = { type: "press", before: "run-1", now: 1000 };
const SENT: ReplanEvent = { type: "answered", result: { kind: "ok" } };

describe("runIdOf", () => {
  it("is the run id of a plan, and empty when there is no run", () => {
    expect(runIdOf(plan({ runId: "run-9" }))).toBe("run-9");
    expect(runIdOf(plan())).toBe("");
    expect(runIdOf(undefined)).toBe("");
  });
});

describe("replanReducer", () => {
  it("a press sends the request and a 202 starts the wait, remembering the plan shown before", () => {
    expect(run([PRESS])).toEqual({ kind: "sending", before: "run-1", startedAt: 1000 });
    expect(run([PRESS, SENT])).toEqual({ kind: "waiting", before: "run-1", startedAt: 1000 });
  });

  it("a failed request ends in failed with its kind, ready to press again", () => {
    for (const kind of ["offline", "error", "none", "not-signed-in"] as const) {
      expect(run([PRESS, { type: "answered", result: { kind } }])).toEqual({ kind: "failed", failure: kind });
    }
    expect(isReplanBusy(run([PRESS, { type: "answered", result: { kind: "error" } }]))).toBe(false);
  });

  it("ignores a second press while sending or waiting", () => {
    const again: ReplanEvent = { type: "press", before: "other", now: 5000 };
    expect(run([PRESS, again])).toEqual({ kind: "sending", before: "run-1", startedAt: 1000 });
    expect(run([PRESS, SENT, again])).toEqual({ kind: "waiting", before: "run-1", startedAt: 1000 });
  });

  it("finishes when a planned plan has a different run than the one shown before", () => {
    const state = run([PRESS, SENT, { type: "polled", result: ok({ runId: "run-2", allocator: "llm" }), now: 4000 }]);
    expect(state).toEqual({ kind: "done", allocator: "llm" });
  });

  it("carries the fallback reason of the new plan", () => {
    const state = run([
      PRESS,
      SENT,
      { type: "polled", result: ok({ runId: "run-2", fallbackReason: "llm_daily_cap_reached" }), now: 4000 },
    ]);
    expect(state).toEqual({ kind: "done", allocator: "baseline", fallbackReason: "llm_daily_cap_reached" });
  });

  it("counts a rejected run as a result", () => {
    const state = run([
      PRESS,
      SENT,
      { type: "polled", result: ok({ planned: false, rejected: true, runId: "run-2" }), now: 4000 },
    ]);
    expect(state.kind).toBe("done");
  });

  it.each([
    ["the same run as before", { runId: "run-1" }],
    ["no run yet (the gap between the delete and the new commit)", { planned: false }],
    ["a run id but nothing planned or rejected", { planned: false, runId: "run-2" }],
  ])("keeps waiting on %s", (_name, extra) => {
    const waiting = run([PRESS, SENT]);
    expect(run([{ type: "polled", result: ok(extra), now: 4000 }], waiting)).toEqual(waiting);
  });

  it("treats no run before the press as the identity none: any run is new", () => {
    const state = run([
      { type: "press", before: "", now: 0 },
      SENT,
      { type: "polled", result: ok({ runId: "run-1" }), now: 3000 },
    ]);
    expect(state.kind).toBe("done");
  });

  it.each(["offline", "error", "none", "not-signed-in"] as const)("keeps waiting after a poll that failed: %s", (kind) => {
    const waiting = run([PRESS, SENT]);
    expect(run([{ type: "polled", result: { kind }, now: 4000 }], waiting)).toEqual(waiting);
  });

  it("times out once the elapsed time (not a tick count) reaches the limit, on a tick or a poll", () => {
    const waiting = run([PRESS, SENT]);
    expect(run([{ type: "tick", now: 1000 + TIMEOUT - 1 }], waiting)).toEqual(waiting);
    expect(run([{ type: "tick", now: 1000 + TIMEOUT }], waiting)).toEqual({ kind: "timedOut" });
    expect(run([{ type: "polled", result: ok({ runId: "run-1" }), now: 1000 + TIMEOUT }], waiting)).toEqual({
      kind: "timedOut",
    });
  });

  it("a plan that arrives exactly at the limit still wins over the timeout", () => {
    const waiting = run([PRESS, SENT]);
    const state = run([{ type: "polled", result: ok({ runId: "run-2" }), now: 1000 + TIMEOUT }], waiting);
    expect(state.kind).toBe("done");
  });

  it("allows a new press after done, timedOut or failed", () => {
    for (const from of [
      { kind: "done", allocator: "llm" },
      { kind: "timedOut" },
      { kind: "failed", failure: "error" },
    ] as ReplanState[]) {
      expect(run([PRESS], from)).toEqual({ kind: "sending", before: "run-1", startedAt: 1000 });
    }
  });

  it("ignores answers and polls that arrive when nothing is waiting", () => {
    expect(run([SENT])).toEqual(IDLE);
    expect(run([{ type: "polled", result: ok({ runId: "x" }), now: 1 }])).toEqual(IDLE);
    expect(run([{ type: "tick", now: 1e9 }])).toEqual(IDLE);
  });
});

describe("isReplanBusy", () => {
  it("is true only while sending or waiting", () => {
    expect(isReplanBusy(IDLE)).toBe(false);
    expect(isReplanBusy({ kind: "sending", before: "", startedAt: 0 })).toBe(true);
    expect(isReplanBusy({ kind: "waiting", before: "", startedAt: 0 })).toBe(true);
    expect(isReplanBusy({ kind: "done", allocator: "llm" })).toBe(false);
    expect(isReplanBusy({ kind: "timedOut" })).toBe(false);
  });
});

describe("replanStatusKey", () => {
  it("says nothing when idle or failed (a failure is an alert, not a status)", () => {
    expect(replanStatusKey(IDLE)).toBeNull();
    expect(replanStatusKey({ kind: "failed", failure: "error" })).toBeNull();
  });

  it("says replanning while sending or waiting", () => {
    expect(replanStatusKey({ kind: "sending", before: "", startedAt: 0 })).toBe("dayplan.replan.waiting");
    expect(replanStatusKey({ kind: "waiting", before: "", startedAt: 0 })).toBe("dayplan.replan.waiting");
  });

  it("says the plan may still arrive after a timeout", () => {
    expect(replanStatusKey({ kind: "timedOut" })).toBe("dayplan.replan.timedOut");
  });

  it("says who made the plan, with one message per fallback reason and a generic one for the unknown", () => {
    expect(replanStatusKey({ kind: "done", allocator: "llm" })).toBe("dayplan.replan.done.llm");
    expect(replanStatusKey({ kind: "done", allocator: "baseline" })).toBe("dayplan.replan.done.baseline");
    const reason = (fallbackReason: string) => replanStatusKey({ kind: "done", allocator: "baseline", fallbackReason });
    expect(reason("llm_daily_cap_reached")).toBe("dayplan.replan.fallback.llm_daily_cap_reached");
    expect(reason("llm_error")).toBe("dayplan.replan.fallback.llm_error");
    expect(reason("llm_timeout")).toBe("dayplan.replan.fallback.llm_timeout");
    expect(reason("llm_invalid_response")).toBe("dayplan.replan.fallback.llm_invalid_response");
    expect(reason("llm_rejected_by_checker")).toBe("dayplan.replan.fallback.llm_rejected_by_checker");
    expect(reason("something_new")).toBe("dayplan.replan.fallback.unknown");
  });
});
