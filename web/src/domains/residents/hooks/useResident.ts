import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { residentQuery } from "../api/queries";
import { residentStateOf } from "../logic/residentState";
import { viewOf } from "../../../shared/query/view";

/**
 * One Resident's page data from the query cache, one entry per id. A page visited before shows at once and a
 * refetch runs behind it (`refreshing`); only a first visit or a Retry shows `loading`, and a failed refetch
 * keeps the page with no alert. When `id` changes the new key has no data, so the page is `loading` and never
 * shows the old person under the new name.
 */
export function useResident(id: string) {
  const query = useQuery(residentQuery(id));
  const { state: view, refreshing } = viewOf(query);
  const { refetch } = query;
  const retry = useCallback(() => void refetch(), [refetch]);

  const state = residentStateOf(view);
  return { state, refreshing: state.kind === "ready" && refreshing, retry };
}
