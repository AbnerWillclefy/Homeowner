import type { QueryViewState } from "../../../shared/query/view";
import type { DayPlan } from "../api/api";
import type { DayPlanState } from "../hooks/useDayPlan";

/**
 * The Day Plan screen state from the query's view state. Null data (the caller has no Home) is a failure of kind
 * `none`, as before; a plan in the cache is `ready` even when a later refetch failed (`viewOf` decides that).
 */
export function dayPlanStateOf(state: QueryViewState<DayPlan | null>): DayPlanState {
  switch (state.kind) {
    case "loading":
    case "failed":
      return state;
    case "ready":
      return state.data === null ? { kind: "failed", reason: "none" } : { kind: "ready", plan: state.data };
  }
}
