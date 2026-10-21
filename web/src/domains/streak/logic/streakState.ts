import type { Streak } from "../api/api";

export interface StreakState {
  streak: Streak | null;
  /** True until the first answer, of any kind, arrives. A refetch later never sets it again. */
  loading: boolean;
}

/** The part of a query result that `streakStateOf` reads. */
export interface StreakSnapshot {
  data: Streak | null | undefined;
  isPending: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
}

/**
 * The Streak card's state. Any first answer ends `loading`, a failure included, so the skeleton never stays up
 * (a failed first load has no data and is no longer pending). A refetch keeps the last number, also when it fails.
 */
export function streakStateOf({ data, isPending, fetchStatus }: StreakSnapshot): StreakState {
  return { streak: data ?? null, loading: isPending && fetchStatus !== "idle" };
}
