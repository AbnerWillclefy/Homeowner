import type { DayPlan } from "../api/api";

/** "N de M feitas" on Today's hero card. `total` is 0 when there is nothing to count: the card then hides the figure and the bar. */
export interface HeroCounts {
  done: number;
  total: number;
}

/**
 * N is what the caller finished today and M is N plus the caller's open Tasks, accepted or still Proposed (both are on
 * their list). A Task shared with another Resident sits once in `mine`; other Residents' Tasks and the pool are not the
 * caller's. Before the plan exists (`planned: false`) there is no M.
 */
export function heroCounts(plan: DayPlan): HeroCounts {
  if (!plan.planned) return { done: 0, total: 0 };
  const done = plan.doneToday.length;
  return { done, total: done + plan.mine.length };
}
