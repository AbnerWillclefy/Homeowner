import type { QueryViewState } from "../../../shared/query/view";
import type { Chore, Failure } from "../api/api";

export type ChoresState =
  | { kind: "loading" }
  | { kind: "failed"; reason: Failure["kind"] }
  | { kind: "ready"; chores: Chore[]; categories: string[]; demands: string[] };

export type ChoreListsState =
  | { kind: "loading" }
  | { kind: "failed"; reason: Failure["kind"] }
  | { kind: "ready"; categories: string[]; demands: string[] };

type Combined = { kind: "loading" } | { kind: "failed"; reason: Failure["kind"] } | { kind: "ready" };

/** Loading while any view is loading; otherwise the first failure in order; otherwise ready. */
export function combineViews(views: QueryViewState<unknown>[]): Combined {
  if (views.some((v) => v.kind === "loading")) return { kind: "loading" };
  const failure = views.find((v) => v.kind === "failed");
  return failure?.kind === "failed" ? { kind: "failed", reason: failure.reason } : { kind: "ready" };
}

/**
 * One screen state from the Categories, Demands and Chores queries. Loading while any of them is loading;
 * otherwise the first failure in the order categories, demands, chores; otherwise ready with all three.
 */
export function choresStateOf(
  categories: QueryViewState<string[]>,
  demands: QueryViewState<string[]>,
  chores: QueryViewState<Chore[]>,
): ChoresState {
  const combined = combineViews([categories, demands, chores]);
  if (combined.kind !== "ready") return combined;
  if (categories.kind !== "ready" || demands.kind !== "ready" || chores.kind !== "ready") return { kind: "loading" };
  return {
    kind: "ready",
    chores: chores.data,
    categories: categories.data,
    demands: demands.data,
  };
}

/** The same for the two lists the Chore form offers, for forms shown before the Home has Chores. */
export function choreListsStateOf(
  categories: QueryViewState<string[]>,
  demands: QueryViewState<string[]>,
): ChoreListsState {
  const combined = combineViews([categories, demands]);
  if (combined.kind !== "ready") return combined;
  if (categories.kind !== "ready" || demands.kind !== "ready") return { kind: "loading" };
  return { kind: "ready", categories: categories.data, demands: demands.data };
}
