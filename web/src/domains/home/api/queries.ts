import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { refetchUnlessSucceeded } from "../../../shared/query/queryClient";
import { getHome, type Home } from "./api";

/** `GET /home`. Home-scoped children go under it, so one partial key reaches them all (ADR 0013). */
export const homeKey = ["home"] as const;

/** The caller's Home, or null when they have none. The queryFn throws an `ApiFailure` on a failed call. */
export const homeQuery = queryOptions({
  queryKey: homeKey,
  queryFn: async (): Promise<Home | null> => toQueryData(await getHome())?.home ?? null,
  refetchOnMount: refetchUnlessSucceeded,
});

const inHomeScope = (key: readonly unknown[]) => key[0] === homeKey[0] && key.length > 1;

/**
 * Cancels and removes every query under the Home (the Day Plan, Chores, Residents, ...) and keeps `["home"]`
 * itself. Called when the Home changes hands: whatever was cached belongs to another Home, and it is removed
 * rather than marked stale so the new Home never shows the old one's data while it loads.
 */
export async function forgetHomeScope(client: QueryClient): Promise<void> {
  await client.cancelQueries({ predicate: (query) => inHomeScope(query.queryKey) });
  client.removeQueries({ predicate: (query) => inHomeScope(query.queryKey) });
}

/**
 * The caller left their Home: forget its data, then show the create form (no Home). The read of the Home itself
 * is cancelled first, so an older answer cannot bring the old Home back over the null.
 */
export async function homeLeft(client: QueryClient): Promise<void> {
  await client.cancelQueries({ queryKey: homeKey, exact: true });
  await forgetHomeScope(client);
  client.setQueryData(homeKey, null);
}

/**
 * The caller joined a Home: reset everything under the old one and read the new Home. A reset empties each query
 * and reads again the ones a screen is showing; `removeQueries` would leave those observers on a query that is no
 * longer in the cache, with nothing to make them read.
 */
export async function homeJoined(client: QueryClient): Promise<void> {
  await client.resetQueries({ predicate: (query) => inHomeScope(query.queryKey) });
  await client.invalidateQueries({ queryKey: homeKey, exact: true });
}
