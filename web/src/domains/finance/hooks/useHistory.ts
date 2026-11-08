import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { viewOf } from "../../../shared/query/view";
import { historyQuery } from "../api/queries";

/** The six months ending at `to`, read once for every category of Gastos to slice. */
export function useHistory(to: string) {
  const query = useQuery(historyQuery(to, 6));
  const { state } = viewOf(query);
  const { refetch } = query;
  return { state, reload: useCallback(async () => void (await refetch()), [refetch]) };
}
