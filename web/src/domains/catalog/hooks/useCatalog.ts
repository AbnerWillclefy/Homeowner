import { useCallback, useEffect, useState } from "react";
import { getCatalog, type CatalogEntry } from "../api/api";
import type { Failure } from "../../chores/api/api";

export type CatalogState =
  | { kind: "loading" }
  | { kind: "failed"; reason: Failure["kind"] }
  | { kind: "ready"; entries: CatalogEntry[] };

/** Loads the Catalog when mounted. */
export function useCatalog() {
  const [state, setState] = useState<CatalogState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const result = await getCatalog();
    setState(result.kind === "ok" ? { kind: "ready", entries: result.entries } : { kind: "failed", reason: result.kind });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}
