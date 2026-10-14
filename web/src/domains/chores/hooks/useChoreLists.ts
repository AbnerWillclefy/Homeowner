import { useCallback, useEffect, useState } from "react";
import type { Failure } from "../api/api";
import { getCategories, getDemands } from "../../profile/api/api";

export type ChoreListsState =
  | { kind: "loading" }
  | { kind: "failed"; reason: Failure["kind"] }
  | { kind: "ready"; categories: string[]; demands: string[] };

/** Loads the Category and Demand lists the Chore form offers. For forms shown before the Home has Chores. */
export function useChoreLists() {
  const [state, setState] = useState<ChoreListsState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const [categories, demands] = await Promise.all([getCategories(), getDemands()]);
    if (categories.kind !== "ok") return setState({ kind: "failed", reason: categories.kind });
    if (demands.kind !== "ok") return setState({ kind: "failed", reason: demands.kind });
    setState({ kind: "ready", categories: categories.ids, demands: demands.ids });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}
