import type { Streak, StreakResult } from "../api/api";

export interface StreakState {
  streak: Streak | null;
  /** True until the first answer, of any kind, arrives. A reload later never sets it again. */
  loading: boolean;
}

export const INITIAL_STREAK_STATE: StreakState = { streak: null, loading: true };

/**
 * The state after an answer from `GET /home/streak`. Any answer ends `loading`, a failure included, so the
 * skeleton never stays up. A failed reload keeps the last number.
 */
export function afterStreakAnswer(previous: StreakState, result: StreakResult): StreakState {
  return { streak: result.kind === "ok" ? result.streak : previous.streak, loading: false };
}
