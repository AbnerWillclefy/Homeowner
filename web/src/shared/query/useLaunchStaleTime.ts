import { useEffect, useRef } from "react";

/**
 * The `staleTime` for a read the Shell turns on once the Home is known. The launch read (ADR 0016) may have filled
 * the entry before the Home answered, and turning `enabled` on reads a stale entry whatever `refetchOnMount` says.
 * So the first time only, an entry already in the cache counts as fresh. Later flips (leave, then create a Home)
 * find the entry removed and read it. Used by `useResidents` and the Shell's Day Plan read.
 */
export function useLaunchStaleTime(hasHome: boolean): number {
  const wasEnabled = useRef(false);
  const staleTime = wasEnabled.current ? 0 : Infinity;
  useEffect(() => {
    if (hasHome) wasEnabled.current = true;
  }, [hasHome]);
  return staleTime;
}
