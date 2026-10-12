import { createContext, useContext } from "react";
import type { useHome } from "../home/useHome";

interface ShellValue {
  home: ReturnType<typeof useHome>;
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
