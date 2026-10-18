import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayPlan, DayPlanResult, ReplanResult } from "../api/api";
import type { ReplanState } from "./replan";
import { createReplanner } from "./replanner";

const POLL = 3000;
const TIMEOUT = 20_000;

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

function setup(reads: DayPlanResult[], replan: ReplanResult = { kind: "ok" }) {
  const states: ReplanState[] = [];
  const plans: DayPlan[] = [];
  const queue = [...reads];
  const readPlan = vi.fn(async (): Promise<DayPlanResult> => queue.shift() ?? queue.at(-1) ?? { kind: "error" });
  const replanHome = vi.fn(async () => replan);
  const replanner = createReplanner({
    replan: replanHome,
    readPlan,
    onChange: (state) => states.push(state),
    onPlan: (p) => plans.push(p),
    pollMs: POLL,
    timeoutMs: TIMEOUT,
  });
  return { replanner, states, plans, readPlan, replanHome, last: () => states.at(-1) };
}

const ok = (extra: Partial<DayPlan> = {}): DayPlanResult => ({ kind: "ok", plan: plan(extra) });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createReplanner", () => {
  it("press goes to sending, then waiting once the request is accepted, without reading yet", async () => {
    const t = setup([ok({ runId: "run-1" })]);
    t.replanner.press("run-1");
    expect(t.last()).toMatchObject({ kind: "sending", before: "run-1" });
    await vi.advanceTimersByTimeAsync(0);
    expect(t.last()).toMatchObject({ kind: "waiting", before: "run-1" });
    expect(t.replanHome).toHaveBeenCalledTimes(1);
    expect(t.readPlan).not.toHaveBeenCalled();
  });

  it("polls every interval until the run changes, then hands the new plan over and stops", async () => {
    const t = setup([ok({ runId: "run-1" }), ok({ planned: false }), ok({ runId: "run-2", allocator: "llm" })]);
    t.replanner.press("run-1");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(POLL);
    expect(t.readPlan).toHaveBeenCalledTimes(1);
    expect(t.last()?.kind).toBe("waiting");
    await vi.advanceTimersByTimeAsync(POLL);
    expect(t.last()?.kind).toBe("waiting");
    await vi.advanceTimersByTimeAsync(POLL);
    expect(t.last()).toEqual({ kind: "done", allocator: "llm" });
    expect(t.plans).toEqual([plan({ runId: "run-2", allocator: "llm" })]);
    await vi.advanceTimersByTimeAsync(POLL * 5);
    expect(t.readPlan).toHaveBeenCalledTimes(3);
  });

  it("keeps polling through failed reads", async () => {
    const t = setup([{ kind: "offline" }, { kind: "error" }, ok({ runId: "run-2" })]);
    t.replanner.press("");
    await vi.advanceTimersByTimeAsync(POLL * 3);
    expect(t.last()?.kind).toBe("done");
  });

  it("times out after the limit, stops polling, and can be pressed again", async () => {
    const t = setup([ok({ runId: "run-1" })]);
    t.replanner.press("run-1");
    await vi.advanceTimersByTimeAsync(TIMEOUT);
    expect(t.last()).toEqual({ kind: "timedOut" });
    const reads = t.readPlan.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL * 5);
    expect(t.readPlan).toHaveBeenCalledTimes(reads);
    t.replanner.press("run-1");
    expect(t.last()?.kind).toBe("sending");
  });

  it("a failed request ends the attempt with no polling", async () => {
    const t = setup([ok({ runId: "run-2" })], { kind: "offline" });
    t.replanner.press("run-1");
    await vi.advanceTimersByTimeAsync(POLL * 3);
    expect(t.last()).toEqual({ kind: "failed", failure: "offline" });
    expect(t.readPlan).not.toHaveBeenCalled();
  });

  it("ignores a second press while busy: one request only", async () => {
    const t = setup([ok({ runId: "run-1" })]);
    t.replanner.press("run-1");
    t.replanner.press("run-1");
    await vi.advanceTimersByTimeAsync(0);
    t.replanner.press("run-1");
    expect(t.replanHome).toHaveBeenCalledTimes(1);
  });

  it("dispose stops polling and drops a read still in flight", async () => {
    const t = setup([ok({ runId: "run-1" }), ok({ runId: "run-2" })]);
    t.replanner.press("run-1");
    await vi.advanceTimersByTimeAsync(0);
    t.replanner.dispose();
    const changes = t.states.length;
    await vi.advanceTimersByTimeAsync(POLL * 10);
    expect(t.readPlan).not.toHaveBeenCalled();
    expect(t.states).toHaveLength(changes);
    expect(t.plans).toEqual([]);
  });

  it("dispose while the request is in flight drops its answer", async () => {
    const t = setup([ok({ runId: "run-2" })]);
    t.replanner.press("run-1");
    t.replanner.dispose();
    await vi.advanceTimersByTimeAsync(POLL * 3);
    expect(t.readPlan).not.toHaveBeenCalled();
    expect(t.plans).toEqual([]);
  });
});
