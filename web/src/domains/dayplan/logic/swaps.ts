import type { DayPlan, PlanTask } from "../api/api";

/** A Task is one-person when it needs one Resident and has no partner (a partner makes it two-person). */
const isOnePerson = (task: PlanTask): boolean => task.people === 1 && !task.with;

/** The caller's Tasks that can be offered in a Swap: the one-person ones they hold. */
export function offerableTasks(plan: DayPlan): PlanTask[] {
  return plan.mine.filter(isOnePerson);
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
    isOnePerson(task) &&
    offerableTasks(plan).length > 0 &&
    !plan.mine.some((mine) => mine.id === task.id) &&
    !plan.swaps.outgoing.some((offer) => offer.requested.id === task.id)
  );
}
