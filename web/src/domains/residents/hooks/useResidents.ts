import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Resident } from "../api/api";
import { residentsKey, residentsQuery } from "../api/queries";
import { useLaunchStaleTime } from "../../../shared/query/useLaunchStaleTime";
import { viewOf } from "../../../shared/query/view";

export type ResidentsState =
  /** Waiting for the first answer, or there is no Home yet. */
  | { kind: "loading" }
  | { kind: "ready"; residents: Resident[] }
  /** The call failed. Today still works and shows a neutral placeholder for every name. */
  | { kind: "failed" };

/**
 * The Residents of the signed-in User's Home from the query cache, read only while there is a Home. Without one
 * the query is disabled and the state is `loading`, as before; a join or leave removes the cached list (see
 * `forgetHomeScope`), so the next Home reads its own. Mounted in the Shell and shared through ShellContext, so
 * every screen reads one copy. `refreshing` is true while a read runs over a list already on screen.
 *
 * `byResidentId` is the join with the Day Plan, which names Residents by their `id`. It answers
 * `undefined` while loading, after a failure and for an id the list does not hold; callers show a placeholder.
 */
export function useResidents(hasHome: boolean) {
  const queryClient = useQueryClient();
  // A list the launch read already cached counts as fresh the first time only (see `useLaunchStaleTime`).
  const staleTime = useLaunchStaleTime(hasHome);
  const query = useQuery({ ...residentsQuery, enabled: hasHome, staleTime });
  const { state: view, refreshing } = viewOf(query);

  const state: ResidentsState =
    view.kind === "ready" ? { kind: "ready", residents: view.data } : view.kind === "failed" ? { kind: "failed" } : { kind: "loading" };

  /** Reads the list again and keeps it on screen meanwhile: a reload after a name change must not flash. */
  const reload = useCallback(() => void queryClient.invalidateQueries({ queryKey: residentsKey, exact: true }), [queryClient]);

  const byResidentId = (residentId: string): Resident | undefined =>
    state.kind === "ready" ? state.residents.find((resident) => resident.id === residentId) : undefined;

  return { state, refreshing: state.kind === "ready" && refreshing, byResidentId, reload };
}
