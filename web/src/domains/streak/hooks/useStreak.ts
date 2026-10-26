import { useQuery } from "@tanstack/react-query";
import { streakQuery } from "../api/queries";
import { streakStateOf, type StreakState } from "../logic/streakState";

/** How long a Streak read counts as fresh, so the launch read is not repeated when the Home answers. */
const LAUNCH_READ_FRESH_MS = 5_000;

/**
 * The current Streak from the query cache: the top bar shows the last number at once, and a refetch runs behind it.
 * Whatever can change it (an accepted Day Plan action) invalidates the Streak query, so the number updates without
 * polling. The Streak is secondary: while it loads, and after any failure, `streak` is null and the bar's Streak
 * slot shows nothing (or its placeholder, during the first load only). A failed refetch keeps the last number.
 * `refreshing` is true while a refetch runs over a number already on screen.
 *
 * Turning `enabled` on reads a stale entry whatever `refetchOnMount` says, and the launch read (ADR 0016) may have
 * filled the Streak before the Home answered. A short `staleTime` keeps that entry fresh across the flip; the launch
 * read stamps its time, so the normal staleness check applies and an entry removed by leaving a Home is read anew.
 *
 * Mounted in the Shell, which is up before the Home is known, so it reads only when `hasHome` is true (as
 * `useResidents` does). Without a Home `loading` is false and `streak` is null.
 */
export function useStreak(hasHome: boolean): StreakState & { refreshing: boolean } {
  const query = useQuery({ ...streakQuery, enabled: hasHome, staleTime: LAUNCH_READ_FRESH_MS });
  return { ...streakStateOf(query), refreshing: query.isFetching && query.data !== undefined };
}
