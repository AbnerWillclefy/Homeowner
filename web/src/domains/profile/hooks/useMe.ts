import { useEffect, useState } from "react";
import { getMe, type Me } from "../../auth/api/meApi";

export type MeState =
  | { kind: "loading" }
  | { kind: "ready"; me: Me }
  /** The call failed (offline, server error). Callers fall back to what they showed before the name existed. */
  | { kind: "failed" };

/**
 * The signed-in User as `GET /me` last said, with the shown name and photo. Mounted in the Shell and shared
 * through ShellContext: Today's greeting reads the name. It does not depend on a Home, so Me works without one.
 */
export function useMe(): MeState {
  const [state, setState] = useState<MeState>({ kind: "loading" });

  useEffect(() => {
    let current = true;
    void getMe().then((result) => {
      if (!current) return;
      if (result.kind === "ok") {
        const { kind: _kind, ...me } = result;
        setState({ kind: "ready", me });
      } else {
        setState({ kind: "failed" });
      }
    });
    return () => {
      current = false;
    };
  }, []);

  return state;
}
