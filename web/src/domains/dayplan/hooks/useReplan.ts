import { useCallback, useEffect, useRef, useState } from "react";
import { getDayPlan, replanHome, type DayPlan } from "../api/api";
import { isReplanBusy, type ReplanState } from "../logic/replan";
import { createReplanner } from "../logic/replanner";

/**
 * "Replan now" for the Day Plan screen (staging only). `runId` is the run of the plan on screen ("" when it has
 * none) and `show` puts a newer plan on screen without the loading state. The timers live in the replanner and
 * stop when the screen is left.
 */
export function useReplan(runId: string, show: (plan: DayPlan) => void) {
  const [state, setState] = useState<ReplanState>({ kind: "idle" });
  const latest = useRef({ runId, show });
  latest.current = { runId, show };
  const replanner = useRef<ReturnType<typeof createReplanner> | null>(null);

  useEffect(() => {
    const created = createReplanner({
      replan: replanHome,
      readPlan: getDayPlan,
      onChange: setState,
      onPlan: (plan) => latest.current.show(plan),
    });
    replanner.current = created;
    return () => {
      created.dispose();
      replanner.current = null;
    };
  }, []);

  const press = useCallback(() => replanner.current?.press(latest.current.runId), []);

  return { state, busy: isReplanBusy(state), press };
}
