import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getNetWorth, type Range } from "../api";

/** The Net worth and its series for one range; each range is cached on its own, and the last one stays on screen while the next loads, so the range control keeps its focus. */
export function useNetWorth(range: Range) {
  const query = useQuery({ queryKey: ["finance", "net-worth", range], queryFn: () => getNetWorth(range), placeholderData: keepPreviousData });
  return { data: query.data, loading: query.isPending, placeholder: query.isPlaceholderData, failed: query.isError && !query.data, reload: () => void query.refetch() };
}
