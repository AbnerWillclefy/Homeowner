import { describe, expect, it } from "vitest";
import { dayPlan, task } from "../testing/fixtures";
import { plannedEffort } from "./plannedEffort";

describe("plannedEffort", () => {
  it("adds the current Effort of the Resident's own Tasks", () => {
    const plan = dayPlan({ mine: [{ ...task("a"), currentEffort: 3 }, { ...task("b"), currentEffort: 4 }] });
    expect(plannedEffort(plan)).toBe(7);
  });

  it("counts nothing from other Residents, the pool or finished Tasks", () => {
    const plan = dayPlan({
      mine: [{ ...task("a"), currentEffort: 3 }],
      pool: [task("p")],
      doneToday: [task("d")],
      others: [{ residentId: "r2", tasks: [task("o")] }],
    });
    expect(plannedEffort(plan)).toBe(3);
  });

  it("is 0 with no plan or no Tasks", () => {
    expect(plannedEffort(null)).toBe(0);
    expect(plannedEffort(undefined)).toBe(0);
    expect(plannedEffort(dayPlan())).toBe(0);
  });
});
