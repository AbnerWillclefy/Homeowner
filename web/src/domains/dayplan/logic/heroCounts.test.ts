import { describe, expect, it } from "vitest";
import { dayPlan, task } from "../testing/fixtures";
import { heroCounts } from "./heroCounts";

const withDone = (ids: string[]) => dayPlan({ doneToday: ids.map((id) => ({ id, choreName: id, completedAt: "2030-01-15T10:00:00Z" }) as never) });

describe("heroCounts", () => {
  it("counts done Tasks against done plus the caller's open ones, Proposed included", () => {
    const plan = { ...withDone(["d1"]), mine: [task("a"), { ...task("b"), committed: true }] };
    expect(heroCounts(plan)).toEqual({ done: 1, total: 3 });
  });

  it("counts a two-person Task the caller holds once, and leaves other Residents' Tasks and the pool out", () => {
    const plan = dayPlan({
      mine: [task("x")],
      others: [{ residentId: "r2", tasks: [task("x"), task("y")] }],
      pool: [task("z")],
    });
    expect(heroCounts(plan)).toEqual({ done: 0, total: 1 });
  });

  it("gives no total before the plan exists, so the card never reads 0 de 0", () => {
    expect(heroCounts({ ...withDone(["d1"]), planned: false, mine: [task("a")] })).toEqual({ done: 0, total: 0 });
  });

  it("gives no total on a rest day with nothing open and nothing done", () => {
    expect(heroCounts(dayPlan({ planned: true, mine: [] })).total).toBe(0);
  });
});
