import type { DayPlan } from "../api/api";

/** The numbers on the Day Plan summary card. A count of zero is left out of the card. */
export interface SummaryCounts {
  /** Tasks for the caller. */
  mine: number;
  /** Distinct Tasks held by other Residents, as one number. */
  others: number;
  /** Open Tasks nobody holds ("still to do"). */
  pool: number;
}

/**
 * A two-person Task appears under each holder, so the other Residents' Tasks are counted by id, once, and a
 * Task the caller shares is theirs only.
 */
export function summaryCounts(plan: DayPlan): SummaryCounts {
  const mineIds = new Set(plan.mine.map((task) => task.id));
  const otherIds = new Set<string>();
  for (const resident of plan.others) {
    for (const task of resident.tasks) {
      if (!mineIds.has(task.id)) otherIds.add(task.id);
    }
  }
  return { mine: plan.mine.length, others: otherIds.size, pool: plan.pool.length };
}
