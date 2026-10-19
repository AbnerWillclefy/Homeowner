import { useEffect, useState } from "react";
import { getStreak } from "../api/api";
import { afterStreakAnswer, INITIAL_STREAK_STATE, type StreakState } from "../logic/streakState";

/**
 * Loads the current Streak on mount and again whenever `reloadKey` changes (the Day Plan's `settled` count and the
 * Today `version`), so finishing a Task updates the number without polling. The Streak is secondary: while it
 * loads, and after any failure, `streak` is null and the card shows nothing (or its skeleton, during the first
 * load only). A failed reload keeps the last number. Only mounted with a Home.
 */
export function useStreak(reloadKey: string): StreakState {
  const [state, setState] = useState<StreakState>(INITIAL_STREAK_STATE);

  useEffect(() => {
    let current = true;
    void getStreak().then((result) => {
      if (!current) return;
      setState((previous) => afterStreakAnswer(previous, result));
    });
    return () => {
      current = false;
    };
  }, [reloadKey]);

  return state;
}
