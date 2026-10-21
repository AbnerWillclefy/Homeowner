import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { streakKey, streakQuery } from "../api/queries";
import { streakStateOf, type StreakState } from "../logic/streakState";

/**
 * The current Streak from the query cache: Today shows the last number at once, and a refetch runs behind it.
 * `reloadKey` changing (the Day Plan's `settled` count and the Today `version`) invalidates it, so finishing a
 * Task updates the number without polling. The Streak is secondary: while it loads, and after any failure,
 * `streak` is null and the card shows nothing (or its skeleton, during the first load only). A failed refetch
 * keeps the last number. `refreshing` is true while a refetch runs over a number already on screen. Only mounted
 * with a Home.
 */
export function useStreak(reloadKey: string): StreakState & { refreshing: boolean } {
  const queryClient = useQueryClient();
  const query = useQuery(streakQuery);
  const firstKey = useRef(reloadKey);

  useEffect(() => {
    // The first render reads through the query itself; only a later change is a reason to ask again.
    if (reloadKey === firstKey.current) return;
    firstKey.current = reloadKey;
    void queryClient.invalidateQueries({ queryKey: streakKey });
  }, [queryClient, reloadKey]);

  return { ...streakStateOf(query), refreshing: query.isFetching && query.data !== undefined };
}
