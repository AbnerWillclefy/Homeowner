import type { ResidentDetail } from "../api/api";
import type { ResidentsState } from "../hooks/useResidents";
import type { ResidentState } from "./residentState";

export type MyCompletionsState =
  /** The id or the history is still loading. */
  | { kind: "loading" }
  | { kind: "ready"; detail: ResidentDetail }
  /** `retry` says which read to run again: without the list there is no id, so no history to read. */
  | { kind: "failed"; retry: "list" | "detail" };

/** The caller's own id: the `you` row of the Residents list, or undefined until there is one. */
export function myResidentId(list: ResidentsState): string | undefined {
  return list.kind === "ready" ? list.residents.find((resident) => resident.you)?.id : undefined;
}

/**
 * The My Completions section's state from the list and the caller's detail. A list that failed (or has no `you`
 * row) is a failure to retry, never "no Completions": an empty answer would be a lie.
 */
export function myCompletionsStateOf(list: ResidentsState, detail: ResidentState): MyCompletionsState {
  if (list.kind === "failed" || (list.kind === "ready" && myResidentId(list) === undefined)) return { kind: "failed", retry: "list" };
  if (list.kind === "loading" || detail.kind === "loading") return { kind: "loading" };
  return detail.kind === "ready" ? { kind: "ready", detail: detail.resident } : { kind: "failed", retry: "detail" };
}
