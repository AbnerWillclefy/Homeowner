import { useCallback, useEffect, useState } from "react";
import { listChores, type Chore, type Failure } from "../api/chores";
import { getCategories, getDemands } from "../api/profile";

export type ChoresState =
  | { kind: "loading" }
  | { kind: "failed"; reason: Failure["kind"] }
  | { kind: "ready"; chores: Chore[]; categories: string[]; demands: string[] };

/** Loads the Home's Chores with the Category and Demand lists the form needs. Only mounted with a Home. */
export function useChores() {
  const [state, setState] = useState<ChoresState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const [categories, demands, chores] = await Promise.all([getCategories(), getDemands(), listChores()]);
    if (categories.kind !== "ok") return setState({ kind: "failed", reason: categories.kind });
    if (demands.kind !== "ok") return setState({ kind: "failed", reason: demands.kind });
    if (chores.kind !== "ok") return setState({ kind: "failed", reason: chores.kind });
    setState({ kind: "ready", chores: chores.chores, categories: categories.ids, demands: demands.ids });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Adds a new Chore, or replaces the one with the same id. */
  const upsert = useCallback((chore: Chore) => {
    setState((current) => {
      if (current.kind !== "ready") return current;
      const exists = current.chores.some((c) => c.id === chore.id);
      const chores = exists ? current.chores.map((c) => (c.id === chore.id ? chore : c)) : [...current.chores, chore];
      return { ...current, chores };
    });
  }, []);

  const remove = useCallback((id: string) => {
    setState((current) =>
      current.kind === "ready" ? { ...current, chores: current.chores.filter((c) => c.id !== id) } : current,
    );
  }, []);

  return { state, reload: load, upsert, remove };
}
