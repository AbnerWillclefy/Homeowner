import { describe, expect, it } from "vitest";
import { dayPlan, task } from "../testing/fixtures";
import { doneInPlan, refusedInPlan } from "./planOverlay";

const NOW = "2026-10-11T13:02:00.000Z";
const shared = { ...task("s"), people: 2, with: ["r2"], category: "kitchen", committed: true };

describe("refusedInPlan", () => {
  it("moves the Task from mine to the pool, Proposed again, and leaves the rest", () => {
    const plan = dayPlan({ mine: [{ ...task("a"), committed: true }, task("b")], pool: [task("p")] });
    const next = refusedInPlan(plan, "a");
    expect(next.mine.map((t) => t.id)).toEqual(["b"]);
    expect(next.pool.map((t) => t.id)).toEqual(["p", "a"]);
    expect(next.pool[1]).toMatchObject({ committed: false, reason: "refused" });
  });

  it("does not change the plan it was given", () => {
    const plan = dayPlan({ mine: [task("a")] });
    refusedInPlan(plan, "a");
    expect(plan.mine).toHaveLength(1);
    expect(plan.pool).toHaveLength(0);
  });

  it("moves only the caller's copy of a two-person Task", () => {
    const plan = dayPlan({ mine: [shared], others: [{ residentId: "r2", tasks: [shared] }] });
    const next = refusedInPlan(plan, "s");
    expect(next.mine).toHaveLength(0);
    expect(next.others[0]!.tasks).toEqual([shared]);
  });

  it("returns the plan as it is for a Task that is not in mine", () => {
    const plan = dayPlan({ pool: [task("p")] });
    expect(refusedInPlan(plan, "p")).toBe(plan);
  });
});

describe("doneInPlan", () => {
  it("moves the Task from mine to doneToday at the given instant, without a completion id", () => {
    const plan = dayPlan({ mine: [{ ...task("a"), category: "kitchen", committed: true }, task("b")] });
    const next = doneInPlan(plan, "a", NOW);
    expect(next.mine.map((t) => t.id)).toEqual(["b"]);
    expect(next.doneToday).toEqual([
      { id: "a", choreName: "Chore a", completedAt: NOW, category: "kitchen", with: [] },
    ]);
  });

  it("keeps the partners of a two-person Task on the Completion and the Task under its partner", () => {
    const plan = dayPlan({ mine: [shared], others: [{ residentId: "r2", tasks: [shared] }] });
    const next = doneInPlan(plan, "s", NOW);
    expect(next.doneToday[0]!.with).toEqual(["r2"]);
    expect(next.others[0]!.tasks).toEqual([shared]);
  });

  it("puts it after what was done earlier, oldest first", () => {
    const earlier = { id: "e", choreName: "Earlier", completedAt: "2026-10-11T08:00:00.000Z", with: [] };
    const next = doneInPlan(dayPlan({ mine: [task("a")], doneToday: [earlier] }), "a", NOW);
    expect(next.doneToday.map((d) => d.id)).toEqual(["e", "a"]);
  });

  it("moves a pool Task, done in one step, from the pool to doneToday", () => {
    const next = doneInPlan(dayPlan({ mine: [task("a")], pool: [task("p"), task("q")] }), "p", NOW);
    expect(next.pool.map((t) => t.id)).toEqual(["q"]);
    expect(next.mine.map((t) => t.id)).toEqual(["a"]);
    expect(next.doneToday.map((d) => d.id)).toEqual(["p"]);
  });

  it("returns the plan as it is for a Task that is in neither list", () => {
    const plan = dayPlan({ others: [{ residentId: "r2", tasks: [task("o")] }] });
    expect(doneInPlan(plan, "o", NOW)).toBe(plan);
  });
});
