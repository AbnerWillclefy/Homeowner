import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getCommitments } from "../../overview/api/api";
import { saoPauloDay } from "../../overview/logic/today";

/** The twelve months from this one (São Paulo's calendar, as the API counts it). The key is its own: Overview caches only the first month under `["finance", "commitments", month]`. */
export function useProjection() {
  const [from] = useState(() => saoPauloDay(new Date()).slice(0, 7));
  const query = useQuery({ queryKey: ["finance", "commitments", from, "months"], queryFn: () => getCommitments(from) });
  return { from, data: query.data, loading: query.isPending, failed: query.isError && !query.data, reload: () => void query.refetch() };
}
