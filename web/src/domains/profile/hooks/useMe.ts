import { useCallback, useEffect, useMemo, useState } from "react";
import { getMe, type Me } from "../../auth/api/meApi";

export type MeState =
  | { kind: "loading" }
  | { kind: "ready"; me: Me }
  /** The call failed (offline, server error). Callers fall back to what they showed before the name existed. */
  | { kind: "failed" };

/**
 * The signed-in User as `GET /me` last said, with the shown name and photo. Mounted in the Shell and shared
 * through ShellContext: Today's greeting reads the name, and the Me screen calls `set` with the answer of a save
 * so every screen updates without another call. It does not depend on a Home, so Me works without one.
 */
export function useMe() {
  const [state, setState] = useState<MeState>({ kind: "loading" });

  const reload = useCallback(async () => {
    const result = await getMe();
    if (result.kind === "ok") {
      const { kind: _kind, ...me } = result;
      setState({ kind: "ready", me });
    } else {
      // Keep a name we already have when only a refresh failed.
      setState((previous) => (previous.kind === "ready" ? previous : { kind: "failed" }));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const set = useCallback((me: Me) => setState({ kind: "ready", me }), []);

  return useMemo(() => ({ state, reload, set }), [state, reload, set]);
}
