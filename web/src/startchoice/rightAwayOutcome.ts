import type { DayPlan } from "../dayplan/api";

export type RightAwayOutcome = "tasks" | "no-energy" | "nothing" | "rejected";

/** What to tell the Resident after "right away" answered, so an empty list always comes with its reason. */
export function rightAwayOutcome(plan: DayPlan): RightAwayOutcome {
  if (plan.rejected) return "rejected";
  if (plan.mine.length > 0) return "tasks";
  return plan.energy === 0 ? "no-energy" : "nothing";
}
