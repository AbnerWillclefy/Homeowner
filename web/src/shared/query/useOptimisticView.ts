import { useQuery, type DefaultError, type QueryKey, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { useCachedData } from "./useCachedData";
import { viewOf, type QueryView } from "./view";

/**
 * `viewOf` for a query whose value is written optimistically from a change handler: the status (loading, error,
 * refreshing) comes from `useQuery` and the value from the cache directly (see `useCachedData`), so a tap on a
 * controlled control is on screen before its handler ends. `read` is the `useQuery` result, for `refetch`.
 */
export function useOptimisticView<T, K extends QueryKey>(
  options: UseQueryOptions<T, DefaultError, T, K>,
): QueryView<T> & { read: UseQueryResult<T> } {
  const read = useQuery(options);
  const data = useCachedData<T>(options.queryKey);
  return { ...viewOf({ data, error: read.error, isFetching: read.isFetching }), read };
}
