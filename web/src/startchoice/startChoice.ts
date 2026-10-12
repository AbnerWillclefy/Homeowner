import type { DayPlan } from "../api/dayPlan";

/** The onboarding that just ended: joining a Home by Invite, or creating one's own. */
export type Flow = "invite" | "onboarding";

/**
 * Whether the start choice (Get my tasks right away, or Start tomorrow) is on screen. It appears once, at the
 * end of either flow, and is gone for good once chosen. Nothing about it is stored: a reload brings neither
 * the flow's end nor the choice back, which is the same as choosing to start tomorrow.
 */
export function showStartChoice({ finished, decided }: { finished: Flow | null; decided: boolean }): boolean {
  return finished !== null && !decided;
}

export type RightAwayOutcome = "tasks" | "no-energy" | "nothing" | "rejected";

/** What to tell the Resident after "right away" answered, so an empty list always comes with its reason. */
export function rightAwayOutcome(plan: DayPlan): RightAwayOutcome {
  if (plan.rejected) return "rejected";
  if (plan.mine.length > 0) return "tasks";
  return plan.energy === 0 ? "no-energy" : "nothing";
}
