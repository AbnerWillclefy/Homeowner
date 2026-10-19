import { describe, expect, it } from "vitest";
import type { DayPlan, PlanTask } from "../api/api";
import { summaryCounts } from "./summaryCounts";

function task(id: string): PlanTask {
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

function plan(parts: { mine?: string[]; others?: Record<string, string[]>; pool?: string[] }): DayPlan {
  return {
    date: "2026-10-11",
    allocationTime: "07:00",
    planned: true,
    rejected: false,
    allocator: "baseline",
    energy: 5,
    mine: (parts.mine ?? []).map(task),
    others: Object.entries(parts.others ?? {}).map(([residentId, ids]) => ({ residentId, tasks: ids.map(task) })),
    pool: (parts.pool ?? []).map(task),
    doneToday: [],
  };
}

describe("summaryCounts", () => {
  it("counts the caller's Tasks, other Residents' Tasks and the pool", () => {
    const counts = summaryCounts(plan({ mine: ["a", "b"], others: { r2: ["c"], r3: ["d", "e"] }, pool: ["f"] }));
    expect(counts).toEqual({ mine: 2, others: 3, pool: 1 });
  });

  it("counts a two-person Task between two other Residents once", () => {
    const counts = summaryCounts(plan({ others: { r2: ["x", "y"], r3: ["x"] } }));
    expect(counts.others).toBe(2);
  });

  it("counts a Task shared with the caller only under mine", () => {
    const counts = summaryCounts(plan({ mine: ["x"], others: { r2: ["x", "y"] } }));
    expect(counts).toEqual({ mine: 1, others: 1, pool: 0 });
  });

  it("gives zeros for an empty plan", () => {
    expect(summaryCounts(plan({}))).toEqual({ mine: 0, others: 0, pool: 0 });
  });
});
