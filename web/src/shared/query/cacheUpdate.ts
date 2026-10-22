import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Changes the cached data of one entry from its newest value, at once. A read in flight is cancelled first (its
 * cancel runs synchronously), so its older answer cannot land afterwards and erase the change. An entry with no
 * data is left alone. Use it for an optimistic write and for its per-field revert.
 */
export function updateCached<T>(client: QueryClient, key: QueryKey, change: (current: T) => T): void {
  void client.cancelQueries({ queryKey: key, exact: true });
  client.setQueryData<T>(key, (current) => (current === undefined ? current : change(current)));
}
