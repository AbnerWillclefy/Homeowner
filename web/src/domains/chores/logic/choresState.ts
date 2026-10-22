import type { QueryViewState } from "../../../shared/query/view";
import type { Chore } from "../api/api";
import type { ChoresState } from "../hooks/useChores";
import type { ChoreListsState } from "../hooks/useChoreLists";

/**
 * One screen state from the Categories, Demands and Chores queries. Loading while any of them is loading;
 * otherwise the first failure in the order categories, demands, chores; otherwise ready with all three.
 */
export function choresStateOf(
  categories: QueryViewState<string[]>,
  demands: QueryViewState<string[]>,
  chores: QueryViewState<Chore[]>,
): ChoresState {
  if (categories.kind === "ready" && demands.kind === "ready" && chores.kind === "ready") {
    return { kind: "ready", chores: chores.data, categories: categories.data, demands: demands.data };
  }
  const parts = [categories, demands, chores];
  if (parts.some((p) => p.kind === "loading")) return { kind: "loading" };
  const failure = parts.find((p) => p.kind === "failed");
  return failure?.kind === "failed" ? { kind: "failed", reason: failure.reason } : { kind: "loading" };
}

/** The same for the two lists the Chore form offers, for forms shown before the Home has Chores. */
export function choreListsStateOf(
  categories: QueryViewState<string[]>,
  demands: QueryViewState<string[]>,
): ChoreListsState {
  const state = choresStateOf(categories, demands, { kind: "ready", data: [] });
  return state.kind === "ready" ? { kind: "ready", categories: state.categories, demands: state.demands } : state;
}
