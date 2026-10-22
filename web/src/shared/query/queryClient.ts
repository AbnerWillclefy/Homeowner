import { QueryClient } from "@tanstack/react-query";

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
