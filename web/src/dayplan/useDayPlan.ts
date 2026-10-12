import { useCallback, useEffect, useState } from "react";
import { getDayPlan, type DayPlan, type Failure } from "../api/dayPlan";

export type DayPlanState =
  | { kind: "loading" }
  | { kind: "failed"; reason: Failure["kind"] | "none" }
  | { kind: "ready"; plan: DayPlan };

/** Loads today's Day Plan, and again whenever `version` changes. Only mounted with a Home. */
export function useDayPlan(version: number) {
  const [state, setState] = useState<DayPlanState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const result = await getDayPlan();
    setState(result.kind === "ok" ? { kind: "ready", plan: result.plan } : { kind: "failed", reason: result.kind });
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  return { state, reload: load };
}
