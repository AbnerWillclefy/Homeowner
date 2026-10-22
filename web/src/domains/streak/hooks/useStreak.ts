import { useQuery } from "@tanstack/react-query";
import { streakQuery } from "../api/queries";
import { streakStateOf, type StreakState } from "../logic/streakState";

/**
 * The current Streak from the query cache: Today shows the last number at once, and a refetch runs behind it.
 * Whatever can change it (an accepted Day Plan action) invalidates the Streak query, so the number updates without
 * polling. The Streak is secondary: while it loads, and after any failure, `streak` is null and the card shows
 * nothing (or its skeleton, during the first load only). A failed refetch keeps the last number. `refreshing` is
 * true while a refetch runs over a number already on screen. Only mounted with a Home.
 */
export function useStreak(): StreakState & { refreshing: boolean } {
  const query = useQuery(streakQuery);
  return { ...streakStateOf(query), refreshing: query.isFetching && query.data !== undefined };
}
