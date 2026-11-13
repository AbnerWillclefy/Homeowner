import { useQuery } from "@tanstack/react-query";
import { getNetWorth, type Range } from "../api";

/** The Net worth and its series for one range; each range is cached on its own. */
export function useNetWorth(range: Range) {
  const query = useQuery({ queryKey: ["finance", "net-worth", range], queryFn: () => getNetWorth(range) });
  return { data: query.data, loading: query.isPending, failed: query.isError && !query.data, reload: () => void query.refetch() };
}
