import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FailureReason, Home } from "../api/api";
import { homeCreated, homeKey, homeLeft, homeQuery } from "../api/queries";
import { viewOf, type QueryViewState } from "../../../shared/query/view";

export type HomeState =
  | { kind: "loading" }
  /** The signed-in User has no Home yet: show the create form. */
  | { kind: "none" }
  | { kind: "ready"; home: Home }
  | { kind: "failed"; reason: FailureReason };

function homeState(state: QueryViewState<Home | null>): HomeState {
  switch (state.kind) {
    case "loading":
    case "failed":
      return state;
    case "ready":
      return state.data === null ? { kind: "none" } : { kind: "ready", home: state.data };
  }
}

/** The caller created or recovered a Home: forget the "none" answers cached while they had none, then show it. */
export function useHomeCreated() {
  const queryClient = useQueryClient();
  return useCallback((home: Home) => homeCreated(queryClient, home), [queryClient]);
}

/**
 * The caller's Home from the query cache, which is only read while signed in (see App). `refreshing` is true
 * while a read runs over a Home already on screen; a failed refresh keeps that Home and shows no alert.
 */
export function useHome() {
  const queryClient = useQueryClient();
  const query = useQuery(homeQuery);
  const { state, refreshing } = viewOf(query);
  const { refetch } = query;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  /** A read that started before is cancelled first, so its older answer cannot bring the old Home back. */
  const setHome = useCallback(
    async (home: Home) => {
      // Exact: only the read of the Home itself, not the reads under it, which a save does not change.
      await queryClient.cancelQueries({ queryKey: homeKey, exact: true });
      queryClient.setQueryData(homeKey, home);
    },
    [queryClient],
  );

  const setCreatedHome = useHomeCreated();

  /**
   * The caller has left their Home: show the create form and forget everything cached under the old Home.
   */
  const clearHome = useCallback(async () => {
    await homeLeft(queryClient);
  }, [queryClient]);

  return { state: homeState(state), refreshing, reload, setHome, setCreatedHome, clearHome };
}
