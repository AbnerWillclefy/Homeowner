import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
 * so Today, Me and the photo flow read one copy and can `reload()` after a change.
 *
 * `byResidentId` is the join with the Day Plan, which names Residents by their `residentId`. It answers
 * `undefined` while loading, after a failure and for an id the list does not hold; callers show a placeholder.
 */
export function useResidents(hasHome: boolean) {
  const [state, setState] = useState<ResidentsState>({ kind: "loading" });
  const latest = useRef(0);

  const load = useCallback(async () => {
    const mine = ++latest.current;
    const result = await getResidents();
    if (mine !== latest.current) return;
    setState(result.kind === "ok" ? { kind: "ready", residents: result.residents } : { kind: "failed" });
  }, []);

  useEffect(() => {
    if (!hasHome) {
      latest.current++;
      setState({ kind: "loading" });
      return;
    }
    void load();
  }, [hasHome, load]);

  const byResidentId = useCallback(
    (residentId: string): Resident | undefined =>
      state.kind === "ready" ? state.residents.find((resident) => resident.residentId === residentId) : undefined,
    [state],
  );

  return useMemo(() => ({ state, byResidentId, reload: load }), [state, byResidentId, load]);
}
