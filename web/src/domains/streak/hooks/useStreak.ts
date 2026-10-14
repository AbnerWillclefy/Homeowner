import { useEffect, useState } from "react";
import { getStreak, type Streak } from "../api/api";

/**
 * Loads the current Streak on mount and again whenever `reloadKey` changes (the Day Plan's `settled` count and the
 * Today `version`), so finishing a Task updates the number without polling. The Streak is secondary: while it
 * loads, and after any failure, this is null and the card shows nothing. A failed reload keeps the last number.
 * Only mounted with a Home.
 */
export function useStreak(reloadKey: string): Streak | null {
  const [streak, setStreak] = useState<Streak | null>(null);

  useEffect(() => {
    let current = true;
    void getStreak().then((result) => {
      if (current && result.kind === "ok") setStreak(result.streak);
    });
    return () => {
      current = false;
    };
  }, [reloadKey]);

  return streak;
}
