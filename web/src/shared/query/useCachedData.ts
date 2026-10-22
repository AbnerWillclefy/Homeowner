import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * The data of one cache entry, re-rendered synchronously when it changes. A query observer tells React about a
 * change on a timer, one tick late, which is too late for a controlled input: React puts the old `checked` back at
 * the end of the event, and the control flickers or ignores the tap. The cache's own listeners run in the same
 * call as `setQueryData`, so an optimistic write made in a change handler is on screen before the handler ends.
 * Read the status (loading, error, refreshing) from `useQuery` and the value from here.
 */
export function useCachedData<T>(key: QueryKey): T | undefined {
  const client = useQueryClient();
  const subscribe = useCallback(
    (onChange: () => void) => client.getQueryCache().subscribe((event) => {
      if (event.type === "updated" || event.type === "added" || event.type === "removed") onChange();
    }),
    [client],
  );
  return useSyncExternalStore(subscribe, () => client.getQueryData<T>(key));
}
