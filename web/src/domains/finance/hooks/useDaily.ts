import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { viewOf } from "../../../shared/query/view";
import { dailyQuery } from "../api/queries";

/** The pace series of a month: this month, the previous one and the usual pace, computed by the server. */
export function useDaily(month: string) {
  const query = useQuery(dailyQuery(month));
  const { state } = viewOf(query);
  const { refetch } = query;
  return { state, reload: useCallback(async () => void (await refetch()), [refetch]) };
}
