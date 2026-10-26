import type { DayPlan } from "../api/api";

/** The Effort of the Resident's own Tasks in the plan, as it stands now. 0 with no plan. */
export function plannedEffort(plan: DayPlan | null | undefined): number {
  return plan ? plan.mine.reduce((sum, task) => sum + task.currentEffort, 0) : 0;
}
