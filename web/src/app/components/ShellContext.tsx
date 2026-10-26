import { createContext, useContext } from "react";
import type { useHome } from "../../domains/home/hooks/useHome";
import type { useMe } from "../../domains/profile/hooks/useMe";
import type { useResidents } from "../../domains/residents/hooks/useResidents";
import type { useStreak } from "../../domains/streak/hooks/useStreak";

interface ShellValue {
  home: ReturnType<typeof useHome>;
  /** The Home's Residents, shared so every screen reads one copy. Not ready until there is a Home. */
  residents: ReturnType<typeof useResidents>;
  /** The signed-in User's own name and photo from `GET /me`. */
  me: ReturnType<typeof useMe>;
  /** The Streak, read once the Home is ready and shown in the top bar. */
  streak: ReturnType<typeof useStreak>;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (value === null) throw new Error("useShell needs the Shell");
  return value;
}
