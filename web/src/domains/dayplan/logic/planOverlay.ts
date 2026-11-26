import type { DayPlan } from "../api/api";

/**
 * The plan as it looks once the caller refused one of their Tasks: it leaves `mine` and sits in the pool again.
 * Only the caller's copy moves, so a two-person Task stays under its partner. Pure; the cache is never written
 * with it (ADR 0029). A Task that is not in `mine` leaves the plan as it is.
 */
export function refusedInPlan(plan: DayPlan, taskId: string): DayPlan {
  const task = plan.mine.find((t) => t.id === taskId);
  if (!task) return plan;
  return {
    ...plan,
    mine: plan.mine.filter((t) => t.id !== taskId),
    pool: [...plan.pool, { ...task, committed: false, reason: "refused" }],
  };
}

/**
 * The plan as it looks once the caller completed a Task at `completedAt` (an instant): from `mine`, or from the
 * pool (the one-step Done), it ends `doneToday`, without a `completionId` (the server has not made the Completion
 * yet, so there is no Change time on it). A Task that is in neither list leaves the plan as it is.
 */
export function doneInPlan(plan: DayPlan, taskId: string, completedAt: string): DayPlan {
  const task = plan.mine.find((t) => t.id === taskId) ?? plan.pool.find((t) => t.id === taskId);
  if (!task) return plan;
  return {
    ...plan,
    mine: plan.mine.filter((t) => t.id !== taskId),
    pool: plan.pool.filter((t) => t.id !== taskId),
    doneToday: [
      ...plan.doneToday,
      { id: task.id, choreName: task.choreName, completedAt, category: task.category, with: task.with ?? [] },
    ],
  };
}
