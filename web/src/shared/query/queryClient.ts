import { QueryClient, type Query } from "@tanstack/react-query";

/**
 * The `refetchOnMount` rule for `GET /me` and the launch reads (ADR 0013, ADR 0016): read on mount only when the
 * entry has not yet succeeded, so data the app already fetched is not requested a second time. Window focus still
 * refreshes it. The cost is that returning to a screen no longer reads the server on mount (see ADR 0016).
 */
export const refetchUnlessSucceeded = (query: Query): boolean => query.state.status !== "success";

/**
 * The defaults for every query and mutation (ADR 0013). Queries are stale at once, so opening a screen or
 * resuming the PWA reads the server again; a failure shows Retry instead of retrying in the background.
 * `networkMode: "always"` keeps the queryFn running while `navigator.onLine` is false: the default "online"
 * would pause it and leave the skeleton up forever, where the API client reports "offline" for the alert.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true, retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}
