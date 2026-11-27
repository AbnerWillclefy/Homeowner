import { describe, expect, it } from "vitest";
import type { DayPlan, SwapOffer } from "../api/api";
import { dayPlan, task } from "../testing/fixtures";
import { canOfferFor, requestableTasks, soleHolder } from "./swaps";

const twoPerson = (id: string) => ({ ...task(id), people: 2 });
const offer = (offered: string, requested: string): SwapOffer => ({
  id: `s-${offered}-${requested}`,
  residentId: "r2",
  offered: task(offered),
  requested: task(requested),
});
const ana = (...tasks: ReturnType<typeof task>[]) => [{ residentId: "ana", tasks }];

describe("requestableTasks", () => {
  it("is every other Resident's one-person Task, with who holds it", () => {
    const plan = dayPlan({ others: [...ana(task("a")), { residentId: "bia", tasks: [task("b")] }] });
    expect(requestableTasks(plan).map((r) => [r.task.id, r.holderId])).toEqual([["a", "ana"], ["b", "bia"]]);
  });

  it("leaves out a two-person Task and a Task with a partner even if people says one", () => {
    const plan = dayPlan({ others: ana(twoPerson("a"), { ...task("b"), with: ["r3"] }, task("c")) });
    expect(requestableTasks(plan).map((r) => r.task.id)).toEqual(["c"]);
  });

  it("leaves out a Task that already has an outgoing offer, whichever of mine was offered", () => {
    const plan = dayPlan({ mine: [task("m")], others: ana(task("a"), task("b")), swaps: { incoming: [], outgoing: [offer("m", "a")] } });
    expect(requestableTasks(plan).map((r) => r.task.id)).toEqual(["b"]);
  });

  it("ignores incoming offers", () => {
    const plan = dayPlan({ others: ana(task("a")), swaps: { incoming: [offer("a", "m")], outgoing: [] } });
    expect(requestableTasks(plan)).toHaveLength(1);
  });

  it.each<[string, Partial<DayPlan>]>([
    ["no other Residents", { others: [] }],
    ["before the day is planned", { planned: false, others: ana(task("a")) }],
    ["after a rejected run", { rejected: true, others: ana(task("a")) }],
  ])("is empty with %s", (_, overrides) => {
    expect(requestableTasks(dayPlan(overrides))).toEqual([]);
  });
});

describe("canOfferFor", () => {
  const plan = dayPlan({ mine: [task("m"), twoPerson("p")], others: ana(task("a")) });

  it("is true for my one-person Task when there is something to ask for", () => {
    expect(canOfferFor(plan, task("m"))).toBe(true);
  });

  it("is false for a two-person Task of mine", () => {
    expect(canOfferFor(plan, twoPerson("p"))).toBe(false);
  });

  it("is false for a Task that is not mine, such as the pool's or another Resident's", () => {
    expect(canOfferFor(plan, task("a"))).toBe(false);
    expect(canOfferFor(plan, task("pool"))).toBe(false);
  });

  it("is false when there is nothing to ask for", () => {
    expect(canOfferFor(dayPlan({ mine: [task("m")] }), task("m"))).toBe(false);
  });

  it("is false when every Task of theirs is already asked for", () => {
    const asked = dayPlan({ mine: [task("m"), task("n")], others: ana(task("a")), swaps: { incoming: [], outgoing: [offer("n", "a")] } });
    expect(canOfferFor(asked, task("m"))).toBe(false);
  });

  it("is false for a Task of mine that is already offered", () => {
    const offered = dayPlan({ mine: [task("m")], others: ana(task("a"), task("b")), swaps: { incoming: [], outgoing: [offer("m", "a")] } });
    expect(canOfferFor(offered, task("m"))).toBe(false);
  });

  it("is false after a rejected run", () => {
    expect(canOfferFor({ ...plan, rejected: true }, task("m"))).toBe(false);
  });
});

describe("soleHolder", () => {
  it("is the Resident when only one holds what can be asked for", () => {
    expect(soleHolder(requestableTasks(dayPlan({ others: ana(task("a"), task("b")) })))).toBe("ana");
  });

  it("is nothing with two Residents or with none", () => {
    expect(soleHolder(requestableTasks(dayPlan({ others: [...ana(task("a")), { residentId: "bia", tasks: [task("b")] }] })))).toBeNull();
    expect(soleHolder([])).toBeNull();
  });
});
