import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CatalogEntry } from "../api/api";
import { catalogQuery } from "../api/queries";
import type { Failure } from "../../chores/api/api";
import { viewOf, type QueryViewState } from "../../../shared/query/view";

export type CatalogState =
  | { kind: "loading" }
  | { kind: "failed"; reason: Failure["kind"] }
  | { kind: "ready"; entries: CatalogEntry[] };

function catalogStateOf(state: QueryViewState<CatalogEntry[]>): CatalogState {
  return state.kind === "ready" ? { kind: "ready", entries: state.data } : state;
}

/**
 * The Catalog, read from the query cache under the same rules as every read: a list seen before shows at once
 * (going back to the picker shows no loading line) and is read again behind it. Only a first load or a Retry is
 * `loading`.
 */
export function useCatalog() {
  const query = useQuery(catalogQuery);
  const { state } = viewOf(query);
  const { refetch } = query;

  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  return { state: catalogStateOf(state), reload };
}
