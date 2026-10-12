import { useCallback, useEffect, useState } from "react";
import { getHome, type FailureReason, type Home } from "../api/home";

export type HomeState =
  | { kind: "loading" }
  /** The signed-in User has no Home yet: show the create form. */
  | { kind: "none" }
  | { kind: "ready"; home: Home }
  | { kind: "failed"; reason: FailureReason };

/** Loads the caller's Home when mounted, which is only while signed in (see App). */
export function useHome() {
  const [state, setState] = useState<HomeState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const result = await getHome();
    if (result.kind === "ok") setState({ kind: "ready", home: result.home });
    else if (result.kind === "none") setState({ kind: "none" });
    else setState({ kind: "failed", reason: result.kind });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setHome = useCallback((home: Home) => setState({ kind: "ready", home }), []);

  /** The caller has left their Home: show the create form. The Home's own sections unmount with it. */
  const clearHome = useCallback(() => setState({ kind: "none" }), []);

  return { state, reload: load, setHome, clearHome };
}
