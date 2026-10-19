import { useShell } from "../../../app/components/ShellContext";
import type { Resident } from "../api/api";

/**
 * A Resident looked up by the id the Day Plan uses (`residentId`), from the Shell's shared list. `resident` is
 * undefined while the list loads, after it failed, or for an id it does not hold, so callers draw a placeholder
 * of the same size instead of leaving a gap.
 */
export function useResidentView(residentId: string): { resident: Resident | undefined } {
  const { residents } = useShell();
  return { resident: residents.byResidentId(residentId) };
}
