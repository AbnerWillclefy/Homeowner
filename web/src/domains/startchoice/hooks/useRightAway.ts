import { useState } from "react";
import { planMyDay, type DayPlan } from "../../dayplan/api/api";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";

export type RightAwayState =
  | { kind: "idle" }
  | { kind: "planning" }
  | { kind: "failed"; reason: "offline" | "error" | "not-signed-in" }
  | { kind: "done"; plan: DayPlan };

/** "Get my tasks right away": one call at a time, so a double tap never sends two. */
export function useRightAway(onPlanned: () => void) {
  const [state, setState] = useState<RightAwayState>({ kind: "idle" });

  const { run: start } = useSubmitOnce(async () => {
    setState({ kind: "planning" });
    const result = await planMyDay();
    if (result.kind === "ok") {
      setState({ kind: "done", plan: result.plan });
      onPlanned();
    } else {
      // A 404 means the Home went away under us: nothing to plan, so it reads as a failure.
      setState({ kind: "failed", reason: result.kind === "none" ? "error" : result.kind });
    }
  });

  return { state, start };
}
