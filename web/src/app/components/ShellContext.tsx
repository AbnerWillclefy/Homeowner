import { createContext, useContext } from "react";
import type { useHome } from "../../domains/home/hooks/useHome";
import type { useMe } from "../../domains/profile/hooks/useMe";
import type { useResidents } from "../../domains/residents/hooks/useResidents";

interface ShellValue {
  home: ReturnType<typeof useHome>;
  /** The Home's Residents, shared so every screen reads one copy. Not ready until there is a Home. */
  residents: ReturnType<typeof useResidents>;
  /** The signed-in User's own name and photo from `GET /me`. */
  me: ReturnType<typeof useMe>;
  /** Bumped whenever the plan changed, so Today reloads. */
  planVersion: number;
  planChanged(): void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (value === null) throw new Error("useShell needs the Shell");
  return value;
}
