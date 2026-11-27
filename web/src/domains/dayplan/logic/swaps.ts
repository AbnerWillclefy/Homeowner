import type { DayPlan, PlanTask } from "../api/api";

/** A Task is one-person when it needs one Resident and has no partner (a partner makes it two-person). */
const isOnePerson = (task: PlanTask): boolean => task.people === 1 && !task.with;

/** What another Resident holds that you can ask for, and who holds it. */
export interface Requestable {
  task: PlanTask;
  holderId: string;
}

/**
 * The other Residents' one-person Tasks you can ask for in a Swap: not two-person, not already asked for in an
 * outgoing offer. Done Tasks are not in `others`. Nothing before the day is planned or after a rejected run.
 * Restrictions and Drained are not known here: the server decides those.
 */
export function requestableTasks(plan: DayPlan): Requestable[] {
  if (!plan.planned || plan.rejected) return [];
  const asked = new Set(plan.swaps.outgoing.map((offer) => offer.requested.id));
  return plan.others.flatMap((other) =>
    other.tasks.filter((task) => isOnePerson(task) && !asked.has(task.id)).map((task) => ({ task, holderId: other.residentId })),
  );
}

/**
 * Whether your own Task shows "Oferecer troca": it is one-person, not already offered, and there is something to
 * ask for in return. The menu item is absent otherwise, never disabled.
 */
export function canOfferFor(plan: DayPlan, task: PlanTask): boolean {
  return (
    isOnePerson(task) &&
    plan.mine.some((mine) => mine.id === task.id) &&
    !plan.swaps.outgoing.some((offer) => offer.offered.id === task.id) &&
    requestableTasks(plan).length > 0
  );
}

/** The one Resident whose Tasks are on offer, when it is exactly one: the sheet then names them. */
export function soleHolder(options: Requestable[]): string | null {
  const holders = new Set(options.map((option) => option.holderId));
  return holders.size === 1 ? [...holders][0]! : null;
}
