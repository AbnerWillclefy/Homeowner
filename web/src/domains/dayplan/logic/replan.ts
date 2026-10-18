import type { MessageKey } from "../../../shared/i18n";
import type { DayPlan, DayPlanResult, ReplanResult } from "../api/api";

/** How long to wait between reads of the Day Plan while a new plan is being made. */
export const REPLAN_POLL_MS = 3000;
/** How long to wait for the new plan before saying it may still arrive. The planner may take up to 65 seconds. */
export const REPLAN_TIMEOUT_MS = 90_000;

type Failed = Exclude<ReplanResult["kind"], "ok">;

/**
 * Where a "Replan now" is. `before` is the run of the plan that was on screen at the press ("" when it had none),
 * so a plan that looks identical but comes from a new run is still recognised as new. `startedAt` is a clock
 * reading in ms, so the timeout follows elapsed time even when a backgrounded app throttles its timers.
 */
export type ReplanState =
  | { kind: "idle" }
  | { kind: "sending"; before: string; startedAt: number }
  | { kind: "waiting"; before: string; startedAt: number }
  | { kind: "done"; allocator: string; fallbackReason?: string }
  | { kind: "timedOut" }
  | { kind: "failed"; failure: Failed };

export type ReplanEvent =
  | { type: "press"; before: string; now: number }
  | { type: "answered"; result: ReplanResult }
  | { type: "polled"; result: DayPlanResult; now: number }
  | { type: "tick"; now: number };

/** The identity of the run behind a plan; "" when there is none. */
export function runIdOf(plan: DayPlan | undefined): string {
  return plan?.runId ?? "";
}

export const isReplanBusy = (state: ReplanState): boolean => state.kind === "sending" || state.kind === "waiting";

/**
 * A new plan is a read with a run other than the one before, that is planned or rejected. A read with no run
 * is the gap between the old plan being deleted and the new one committed: still waiting.
 */
function arrived(before: string, result: DayPlanResult): DayPlan | null {
  if (result.kind !== "ok") return null;
  const { plan } = result;
  const run = runIdOf(plan);
  return run !== "" && run !== before && (plan.planned || plan.rejected) ? plan : null;
}

export function replanReducer(state: ReplanState, event: ReplanEvent, timeoutMs = REPLAN_TIMEOUT_MS): ReplanState {
  switch (event.type) {
    case "press":
      return isReplanBusy(state) ? state : { kind: "sending", before: event.before, startedAt: event.now };
    case "answered":
      if (state.kind !== "sending") return state;
      if (event.result.kind !== "ok") return { kind: "failed", failure: event.result.kind };
      return { kind: "waiting", before: state.before, startedAt: state.startedAt };
    case "polled": {
      if (state.kind !== "waiting") return state;
      const plan = arrived(state.before, event.result);
      if (plan) {
        const done: ReplanState = { kind: "done", allocator: plan.allocator };
        return plan.fallbackReason ? { ...done, fallbackReason: plan.fallbackReason } : done;
      }
      return event.now - state.startedAt >= timeoutMs ? { kind: "timedOut" } : state;
    }
    case "tick":
      return state.kind === "waiting" && event.now - state.startedAt >= timeoutMs ? { kind: "timedOut" } : state;
  }
}

const FALLBACK_REASONS = [
  "llm_daily_cap_reached",
  "llm_error",
  "llm_timeout",
  "llm_invalid_response",
  "llm_rejected_by_checker",
] as const;

const isKnownReason = (reason: string): reason is (typeof FALLBACK_REASONS)[number] =>
  (FALLBACK_REASONS as readonly string[]).includes(reason);

/**
 * The calm status line for a state, or null when there is none. A failure is not here: it is an alert, with the
 * wording of `ACTION_FAILURE_KEY`. A fallback is said in plain words so a test run is not taken for an AI result.
 */
export function replanStatusKey(state: ReplanState): MessageKey | null {
  switch (state.kind) {
    case "sending":
    case "waiting":
      return "dayplan.replan.waiting";
    case "timedOut":
      return "dayplan.replan.timedOut";
    case "done":
      if (state.fallbackReason) {
        return isKnownReason(state.fallbackReason)
          ? `dayplan.replan.fallback.${state.fallbackReason}`
          : "dayplan.replan.fallback.unknown";
      }
      return state.allocator === "llm" ? "dayplan.replan.done.llm" : "dayplan.replan.done.baseline";
    default:
      return null;
  }
}
