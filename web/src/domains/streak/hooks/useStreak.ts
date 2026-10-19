import { useEffect, useState } from "react";
import { getStreak, type Streak } from "../api/api";

export interface StreakState {
  streak: Streak | null;
  /** True until the first answer, of any kind, arrives. A reload later never sets it again. */
  loading: boolean;
}

/**
 * Loads the current Streak on mount and again whenever `reloadKey` changes (the Day Plan's `settled` count and the
 * Today `version`), so finishing a Task updates the number without polling. The Streak is secondary: while it
 * loads, and after any failure, `streak` is null and the card shows nothing (or its skeleton, during the first
 * load only). A failed reload keeps the last number. Only mounted with a Home.
 */
export function useStreak(reloadKey: string): StreakState {
  const [state, setState] = useState<StreakState>({ streak: null, loading: true });

  useEffect(() => {
    let current = true;
    void getStreak().then((result) => {
      if (!current) return;
      setState((previous) => ({ streak: result.kind === "ok" ? result.streak : previous.streak, loading: false }));
    });
    return () => {
      current = false;
    };
  }, [reloadKey]);

  return state;
}
