import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { viewOf } from "../../../shared/query/view";
import { reportQuery } from "../api/queries";

/** The month's report and the month before it. */
export function useReport(month: string) {
  const query = useQuery(reportQuery(month));
  const { state, refreshing } = viewOf(query);
  const { refetch } = query;
  return { state, refreshing, reload: useCallback(async () => void (await refetch()), [refetch]) };
}
