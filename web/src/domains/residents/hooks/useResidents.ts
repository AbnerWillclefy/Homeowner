import { useEffect, useState } from "react";
import { getResidents, type Resident } from "../api/api";

export type ResidentsState =
  /** Waiting for the first answer, or there is no Home yet. */
  | { kind: "loading" }
  | { kind: "ready"; residents: Resident[] }
  /** The call failed. Today still works and shows a neutral placeholder for every name. */
  | { kind: "failed" };

/**
 * The Residents of the signed-in User's Home, loaded once while there is a Home and again whenever the Home
 * appears, disappears or changes hands (a join or a leave). Mounted in the Shell and shared through ShellContext,
 * so every screen reads one copy.
 *
 * `byResidentId` is the join with the Day Plan, which names Residents by their `residentId`. It answers
 * `undefined` while loading, after a failure and for an id the list does not hold; callers show a placeholder.
 */
export function useResidents(hasHome: boolean) {
  const [state, setState] = useState<ResidentsState>({ kind: "loading" });

  useEffect(() => {
    if (!hasHome) {
      setState({ kind: "loading" });
      return;
    }
    let current = true;
    void getResidents().then((result) => {
      if (!current) return;
      setState(result.kind === "ok" ? { kind: "ready", residents: result.residents } : { kind: "failed" });
    });
    return () => {
      current = false;
    };
  }, [hasHome]);

  const byResidentId = (residentId: string): Resident | undefined =>
    state.kind === "ready" ? state.residents.find((resident) => resident.residentId === residentId) : undefined;

  return { state, byResidentId };
}
