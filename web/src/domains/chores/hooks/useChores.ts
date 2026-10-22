import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Chore } from "../api/api";
import { choresQuery } from "../api/queries";
import { categoriesQuery, demandsQuery } from "../../profile/api/queries";
import { removeChoreFromCache, saveChoreInCache } from "../logic/choreCache";
import { choresStateOf, type ChoresState } from "../logic/choresState";
import { viewOf } from "../../../shared/query/view";

export type { ChoresState };

/**
 * The Home's Chores with the Category and Demand lists the form needs, from three queries in the cache. Only
 * mounted with a Home. Cached lists show at once and a refetch runs behind them (`refreshing`); only a first
 * load or a Retry shows the loading state, and a failed refetch keeps the lists on screen with no alert.
 *
 * `upsert` and `remove` write what the server answered into the Chores cache, so a create, edit or delete sends
 * no new read of the list. Nothing is optimistic.
 */
export function useChores() {
  const queryClient = useQueryClient();
  const categories = useQuery(categoriesQuery);
  const demands = useQuery(demandsQuery);
  const chores = useQuery(choresQuery);
  const views = [viewOf(categories), viewOf(demands), viewOf(chores)] as const;
  const state = choresStateOf(views[0].state, views[1].state, views[2].state);
  const refreshing = state.kind === "ready" && views.some((v) => v.refreshing);
  const { refetch: refetchCategories } = categories;
  const { refetch: refetchDemands } = demands;
  const { refetch: refetchChores } = chores;

  /** Retry: reads all three again. */
  const reload = useCallback(async () => {
    await Promise.all([refetchCategories(), refetchDemands(), refetchChores()]);
  }, [refetchCategories, refetchDemands, refetchChores]);

  /** Adds a new Chore, or replaces the one with the same id. */
  const upsert = useCallback((chore: Chore) => void saveChoreInCache(queryClient, chore), [queryClient]);

  const remove = useCallback((id: string) => void removeChoreFromCache(queryClient, id), [queryClient]);

  return { state, refreshing, reload, upsert, remove };
}
