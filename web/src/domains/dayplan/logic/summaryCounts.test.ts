import { describe, expect, it } from "vitest";
import type { DayPlan } from "../api/api";
import { dayPlan, task } from "../testing/fixtures";
import { proposedCount, showAcceptAll, summaryCounts } from "./summaryCounts";

function plan(parts: { mine?: string[]; others?: Record<string, string[]>; pool?: string[] }): DayPlan {
  return dayPlan({
    mine: (parts.mine ?? []).map(task),
    others: Object.entries(parts.others ?? {}).map(([residentId, ids]) => ({ residentId, tasks: ids.map(task) })),
    pool: (parts.pool ?? []).map(task),
  });
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

describe("Aceitar todas", () => {
  const withCommitted = (proposed: number, committed: number) =>
    dayPlan({
      mine: [
        ...Array.from({ length: proposed }, (_, i) => task(`p${i}`)),
        ...Array.from({ length: committed }, (_, i) => ({ ...task(`c${i}`), committed: true })),
      ],
    });

  it.each([
    [0, 0, false],
    [1, 0, false],
    [2, 0, true],
    [3, 0, true],
    [1, 2, false],
    [2, 1, true],
    [0, 3, false],
  ])("with %i Proposed and %i Committed shows it: %s", (proposed, committed, shown) => {
    const plan = withCommitted(proposed, committed);
    expect(proposedCount(plan)).toBe(proposed);
    expect(showAcceptAll(plan)).toBe(shown);
  });

  it("counts only the caller's Tasks, never another Resident's or the pool", () => {
    expect(showAcceptAll(plan({ mine: ["a"], others: { r2: ["b", "c"] }, pool: ["d", "e"] }))).toBe(false);
  });
});
