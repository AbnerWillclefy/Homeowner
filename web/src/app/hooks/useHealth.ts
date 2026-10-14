import { useCallback, useEffect, useState } from "react";
import { getHealth, type HealthResult } from "../api/healthApi";

export type HealthState = { kind: "loading" } | HealthResult;

export function useHealth(): { state: HealthState; retry: () => void } {
  const [state, setState] = useState<HealthState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    getHealth(controller.signal).then((result) => {
      if (!controller.signal.aborted) setState(result);
    });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
