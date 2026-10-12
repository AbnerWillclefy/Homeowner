import { useCallback, useEffect, useMemo, useState } from "react";
import { getDayPlan, type DayPlan, type Failure } from "../api/dayPlan";
import { latestOnly } from "./latestOnly";

export type DayPlanState =
  | { kind: "loading" }
  | { kind: "failed"; reason: Failure["kind"] | "none" }
  | { kind: "ready"; plan: DayPlan };

/** Loads today's Day Plan, and again whenever `version` changes. Only mounted with a Home. */
export function useDayPlan(version: number) {
  const [state, setState] = useState<DayPlanState>({ kind: "loading" });

  const fetchPlan = useMemo(
    () =>
      latestOnly(getDayPlan, (result) =>
        setState(result.kind === "ok" ? { kind: "ready", plan: result.plan } : { kind: "failed", reason: result.kind }),
      ),
    [],
  );

  const load = useCallback(() => {
    setState({ kind: "loading" });
    return fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    void load();
  }, [load, version]);

  return { state, reload: load };
}
