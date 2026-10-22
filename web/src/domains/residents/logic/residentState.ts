import type { ResidentDetail } from "../api/api";
import type { QueryViewState } from "../../../shared/query/view";

export type ResidentState =
  | { kind: "loading" }
  | { kind: "ready"; resident: ResidentDetail }
  /** The Resident is not in this Home (or the id is nonsense): a calm "not found", never a redirect. */
  | { kind: "not-found" }
  /** The call failed; `offline` says the service could not be reached. Retry loads again. */
  | { kind: "failed"; reason: "offline" | "error" };

/** The page's state from the query's view: a null Resident is "not found", and any failure but offline is "error". */
export function residentStateOf(view: QueryViewState<ResidentDetail | null>): ResidentState {
  if (view.kind === "loading") return view;
  if (view.kind === "failed") return { kind: "failed", reason: view.reason === "offline" ? "offline" : "error" };
  return view.data === null ? { kind: "not-found" } : { kind: "ready", resident: view.data };
}
