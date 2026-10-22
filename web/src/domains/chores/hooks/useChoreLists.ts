import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoriesQuery, demandsQuery } from "../../profile/api/queries";
import { choreListsStateOf, type ChoreListsState } from "../logic/choresState";
import { viewOf } from "../../../shared/query/view";

export type { ChoreListsState };

/** The Category and Demand lists the Chore form offers, from the cache. For forms shown before the Home has Chores. */
export function useChoreLists() {
  const categories = useQuery(categoriesQuery);
  const demands = useQuery(demandsQuery);
  const state = choreListsStateOf(viewOf(categories).state, viewOf(demands).state);
  const { refetch: refetchCategories } = categories;
  const { refetch: refetchDemands } = demands;

  const reload = useCallback(async () => {
    await Promise.all([refetchCategories(), refetchDemands()]);
  }, [refetchCategories, refetchDemands]);

  return { state, reload };
}
