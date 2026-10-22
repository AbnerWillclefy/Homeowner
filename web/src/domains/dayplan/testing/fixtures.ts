import type { DayPlan, PlanTask } from "../api/api";

export function task(id: string): PlanTask {
  return {
    id,
    choreId: `c-${id}`,
    choreName: `Chore ${id}`,
    windowStart: "2026-10-11",
    windowEnd: "2026-10-12",
    currentEffort: 2,
    baseEffort: 2,
    people: 1,
    importance: "normal",
  };
}

/** A planned, empty day plan; tests override the parts they care about. */
export function dayPlan(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    date: "2026-10-11",
    allocationTime: "07:00",
    planned: true,
    rejected: false,
    allocator: "baseline",
    energy: 5,
    mine: [],
    others: [],
    pool: [],
    doneToday: [],
    swaps: { incoming: [], outgoing: [] },
    ...overrides,
  };
}
