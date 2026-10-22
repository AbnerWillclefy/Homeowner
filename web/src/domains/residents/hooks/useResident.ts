import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ResidentDetail } from "../api/api";
import { residentQuery } from "../api/queries";
import { viewOf } from "../../../shared/query/view";

export type ResidentState =
  | { kind: "loading" }
  | { kind: "ready"; resident: ResidentDetail }
  /** The Resident is not in this Home (or the id is nonsense): a calm "not found", never a redirect. */
  | { kind: "not-found" }
  /** The call failed; `offline` says the service could not be reached. Retry loads again. */
  | { kind: "failed"; reason: "offline" | "error" };

/**
 * One Resident's page data from the query cache, one entry per id. A page visited before shows at once and a
 * refetch runs behind it (`refreshing`); only a first visit or a Retry shows `loading`, and a failed refetch
 * keeps the page with no alert. When `id` changes the new key has no data, so the page is `loading` and never
 * shows the old person under the new name.
 */
export function useResident(id: string) {
  const query = useQuery(residentQuery(id));
  const { state: view, refreshing } = viewOf(query);
  const { refetch } = query;
  const retry = useCallback(() => void refetch(), [refetch]);

  let state: ResidentState;
  switch (view.kind) {
    case "loading":
      state = { kind: "loading" };
      break;
    case "failed":
      // A lost session ends in the guard's redirect to sign-in; until then this is an ordinary failure.
      state = { kind: "failed", reason: view.reason === "offline" ? "offline" : "error" };
      break;
    case "ready":
      // No Home cannot reach this page through HomeGate; if it happens, "not found" is the honest neutral answer.
      state = view.data === null ? { kind: "not-found" } : { kind: "ready", resident: view.data };
      break;
  }
  return { state, refreshing: state.kind === "ready" && refreshing, retry };
}
