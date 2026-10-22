import { queryOptions } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { getCatalog, type CatalogEntry } from "./api";

/** `GET /catalog`. A fixed list, the same for every Home, so the key sits outside `["home"]`. Read under the same rules as everything else. */
export const catalogKey = ["catalog"] as const;

/**
 * The Catalog's Chores. The queryFn throws an `ApiFailure` on a failed call. `proposeChores` is a POST that
 * builds a proposal from answers; it is not a read, so it stays out of the cache.
 */
export const catalogQuery = queryOptions({
  queryKey: catalogKey,
  queryFn: async (): Promise<CatalogEntry[]> => toQueryData(await getCatalog()).entries,
});
