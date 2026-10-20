import type { DayPlan, PlanTask } from "../api/api";

/** The caller's Tasks that can be offered in a Swap: the one-person ones they hold (a partner makes it two-person). */
export function offerableTasks(plan: DayPlan): PlanTask[] {
  return plan.mine.filter((task) => task.people === 1 && !task.with);
}

/**
 * Whether another Resident's Task shows a Swap control. Not for a two-person Task, before the day is planned,
 * after a rejected run, when the caller has nothing to offer, for their own Task, or when that Task already has
 * an outgoing offer. Restrictions and Drained are not known here: the server decides those.
 */
export function canOfferFor(plan: DayPlan, task: PlanTask): boolean {
  return (
    plan.planned &&
    !plan.rejected &&
    task.people === 1 &&
    offerableTasks(plan).length > 0 &&
    !plan.mine.some((mine) => mine.id === task.id) &&
    !plan.swaps.outgoing.some((offer) => offer.requested.id === task.id)
  );
}
