import { useCallback, useEffect, useRef, useState } from "react";
import { getMe, type Me } from "../../auth/api/meApi";

export type MeState =
  | { kind: "loading" }
  | { kind: "ready"; me: Me }
  /** The call failed (offline, server error). Callers fall back to what they showed before the name existed. */
  | { kind: "failed" };

/**
 * The signed-in User as `GET /me` last said, with the shown name and photo. Mounted in the Shell and shared
 * through ShellContext: Today's greeting and the Me header read it. It does not depend on a Home, so Me works
 * without one.
 *
 * `update` changes the current User from its newest value (for a change that lands after a slow call). `set` puts in a User the API just answered (after a name is saved), so every screen shows it at once without
 * another request. `reload` asks again, after a failure; it shows `loading` meanwhile.
 */
export function useMe() {
  const [state, setState] = useState<MeState>({ kind: "loading" });
  // The newest request wins: a slow answer never overwrites a `set` or a later load.
  const latest = useRef(0);

  const reload = useCallback(() => {
    const mine = ++latest.current;
    setState({ kind: "loading" });
    void getMe().then((result) => {
      if (mine !== latest.current) return;
      if (result.kind === "ok") {
        const { kind: _kind, ...me } = result;
        setState({ kind: "ready", me });
      } else {
        setState({ kind: "failed" });
      }
    });
  }, []);

  const set = useCallback((me: Me) => {
    latest.current += 1;
    setState({ kind: "ready", me });
  }, []);

  /** Changes the User from the newest value, so a slow call never overwrites a `set` that landed meanwhile. */
  const update = useCallback((change: (current: Me) => Me) => {
    setState((current) => (current.kind === "ready" ? { kind: "ready", me: change(current.me) } : current));
  }, []);

  useEffect(() => {
    reload();
    return () => {
      latest.current += 1;
    };
  }, [reload]);

  return { state, set, update, reload };
}
