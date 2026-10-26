import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { streakQuery } from "../api/queries";
import { streakStateOf, type StreakState } from "../logic/streakState";

/**
 * The current Streak from the query cache: the top bar shows the last number at once, and a refetch runs behind it.
 * Whatever can change it (an accepted Day Plan action) invalidates the Streak query, so the number updates without
 * polling. The Streak is secondary: while it loads, and after any failure, `streak` is null and the bar's Streak
 * slot shows nothing (or its placeholder, during the first load only). A failed refetch keeps the last number.
 * `refreshing` is true while a refetch runs over a number already on screen.
 *
 * Mounted in the Shell, which is up before the Home is known, so it reads only when `hasHome` is true (as
 * `useResidents` does). Without a Home `loading` is false and `streak` is null.
 */
export function useStreak(hasHome: boolean): StreakState & { refreshing: boolean } {
  // The launch read (ADR 0016) may have filled the Streak before the Home answered. Turning `enabled` on reads a
  // stale entry whatever `refetchOnMount` says, so the first time only, an entry already in the cache counts as
  // fresh. Later flips (leave, then create a Home) find it removed and read it.
  const wasEnabled = useRef(false);
  const query = useQuery({ ...streakQuery, enabled: hasHome, staleTime: wasEnabled.current ? 0 : Infinity });
  useEffect(() => {
    if (hasHome) wasEnabled.current = true;
  }, [hasHome]);
  return { ...streakStateOf(query), refreshing: query.isFetching && query.data !== undefined };
}
