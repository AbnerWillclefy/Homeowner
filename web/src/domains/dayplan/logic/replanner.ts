import type { DayPlan, DayPlanResult, ReplanResult } from "../api/api";
import {
  REPLAN_POLL_MS,
  REPLAN_TIMEOUT_MS,
  replanReducer,
  type ReplanEvent,
  type ReplanState,
} from "./replan";

export interface ReplannerDeps {
  /** Asks for a new plan (`replanHome`). */
  replan(): Promise<ReplanResult>;
  /** Reads the Day Plan (`getDayPlan`). */
  readPlan(): Promise<DayPlanResult>;
  /** Called with every new state. */
  onChange(state: ReplanState): void;
  /** Called once with the new plan when it arrives, so the screen can show it. */
  onPlan(plan: DayPlan): void;
  now?(): number;
  pollMs?: number;
  timeoutMs?: number;
}

/**
 * Runs one "Replan now" at a time: sends the request, then reads the Day Plan every `pollMs` until the run
 * changes or `timeoutMs` has passed. Reads are chained with setTimeout (never overlapping). `dispose` stops it
 * and drops any answer still on its way. No React here, so it is tested with fake timers.
 */
export function createReplanner(deps: ReplannerDeps) {
  const now = deps.now ?? Date.now;
  const pollMs = deps.pollMs ?? REPLAN_POLL_MS;
  const timeoutMs = deps.timeoutMs ?? REPLAN_TIMEOUT_MS;
  let state: ReplanState = { kind: "idle" };
  let disposed = false;
  let attempt = 0;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let limitTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimers() {
    clearTimeout(pollTimer);
    clearTimeout(limitTimer);
    pollTimer = limitTimer = undefined;
  }

  function dispatch(event: ReplanEvent) {
    const next = replanReducer(state, event, timeoutMs);
    if (next === state) return;
    state = next;
    if (state.kind !== "sending" && state.kind !== "waiting") clearTimers();
    deps.onChange(state);
  }

  /** True while the answer for `mine` is still wanted: not disposed and no newer attempt. */
  const current = (mine: number) => !disposed && mine === attempt;

  function schedulePoll(mine: number) {
    pollTimer = setTimeout(async () => {
      const result = await deps.readPlan();
      if (!current(mine) || state.kind !== "waiting") return;
      dispatch({ type: "polled", result, now: now() });
      if (state.kind === "done" && result.kind === "ok") deps.onPlan(result.plan);
      else if (state.kind === "waiting") schedulePoll(mine);
    }, pollMs);
  }

  return {
    /** `before` is the run id of the plan on screen ("" when it has none). Ignored while busy. */
    press(before: string) {
      if (disposed || state.kind === "sending" || state.kind === "waiting") return;
      const mine = ++attempt;
      dispatch({ type: "press", before, now: now() });
      // The limit counts from the press and the reducer checks elapsed time, so a throttled timer cannot stretch it.
      limitTimer = setTimeout(() => current(mine) && dispatch({ type: "tick", now: now() }), timeoutMs);
      void deps.replan().then((result) => {
        if (!current(mine)) return;
        dispatch({ type: "answered", result });
        if (state.kind !== "waiting") return;
        schedulePoll(mine);
      });
    },
    dispose() {
      disposed = true;
      clearTimers();
      state = { kind: "idle" };
    },
  };
}
