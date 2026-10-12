import { describe, expect, it } from "vitest";
import type { DayPlan } from "../api/dayPlan";
import { rightAwayOutcome } from "./rightAwayOutcome";

const TASK = {
  id: "t1",
  choreId: "c1",
  choreName: "Wash dishes",
  windowStart: "2026-10-11",
  windowEnd: "2026-10-12",
  currentEffort: 3,
  baseEffort: 2,
  people: 1,
  importance: "normal",
};

function plan(over: Partial<DayPlan>): DayPlan {
  return {
    date: "2026-10-11",
    allocationTime: "07:00",
    planned: true,
    rejected: false,
    allocator: "baseline",
    energy: 5,
    mine: [TASK],
    others: [],
    pool: [],
    ...over,
  };
}

describe("rightAwayOutcome", () => {
  it("is tasks when some were given", () => {
    expect(rightAwayOutcome(plan({}))).toBe("tasks");
  });

  it("says no Energy, not an empty list, when today's Energy is 0", () => {
    expect(rightAwayOutcome(plan({ energy: 0, mine: [] }))).toBe("no-energy");
  });

  it("is nothing when there is Energy but the pool had nothing for them", () => {
    expect(rightAwayOutcome(plan({ mine: [] }))).toBe("nothing");
  });

  it("is rejected when the checker refused the plan", () => {
    expect(rightAwayOutcome(plan({ planned: false, rejected: true, mine: [] }))).toBe("rejected");
  });
});
