import type { DayPlanState } from "../hooks/useDayPlan";

/**
 * The state to show when a load starts. Only a screen with nothing on it shows loading (the first load, or a
 * Retry after a failure); a plan already on screen stays until the new answer replaces it, so a reload after a
 * Check-in, the start choice or a join never brings the skeleton back.
 */
export function whenLoadStarts(current: DayPlanState): DayPlanState {
  return current.kind === "ready" ? current : { kind: "loading" };
}
