import { describe, expect, it } from "vitest";
import type { SwapOffer } from "../api/api";
import { dayPlan, task } from "../testing/fixtures";
import { canOfferFor, offerableTasks } from "./swaps";

const twoPerson = (id: string) => ({ ...task(id), people: 2 });
const offer = (offered: string, requested: string): SwapOffer => ({
  id: `s-${offered}-${requested}`,
  residentId: "r2",
  offered: task(offered),
  requested: task(requested),
});

describe("offerableTasks", () => {
  it("is the one-person Tasks I hold", () => {
    const plan = dayPlan({ mine: [task("a"), twoPerson("b")] });
    expect(offerableTasks(plan).map((t) => t.id)).toEqual(["a"]);
  });

  it("treats a Task with a partner as two-person even if people says one", () => {
    const plan = dayPlan({ mine: [{ ...task("a"), with: ["r2"] }] });
    expect(offerableTasks(plan)).toEqual([]);
  });

  it("is empty when I hold nothing", () => {
    expect(offerableTasks(dayPlan())).toEqual([]);
  });
});

describe("canOfferFor", () => {
  const plan = dayPlan({ mine: [task("m")] });

  it("shows the control for another Resident's one-person Task when I hold a one-person Task", () => {
    expect(canOfferFor(plan, task("o"))).toBe(true);
  });

  it("hides it for a two-person Task", () => {
    expect(canOfferFor(plan, twoPerson("o"))).toBe(false);
  });

  it("hides it before the day is planned", () => {
    expect(canOfferFor(dayPlan({ planned: false, mine: [task("m")] }), task("o"))).toBe(false);
  });

  it("hides it after a rejected run", () => {
    expect(canOfferFor(dayPlan({ rejected: true, mine: [task("m")] }), task("o"))).toBe(false);
  });

  it("hides it when I hold no one-person Task", () => {
    expect(canOfferFor(dayPlan(), task("o"))).toBe(false);
    expect(canOfferFor(dayPlan({ mine: [twoPerson("m")] }), task("o"))).toBe(false);
  });

  it("hides it when that Task already has an outgoing offer, whichever of my Tasks was offered", () => {
    const withOffer = dayPlan({ mine: [task("m"), task("n")], swaps: { incoming: [], outgoing: [offer("n", "o")] } });
    expect(canOfferFor(withOffer, task("o"))).toBe(false);
    expect(canOfferFor(withOffer, task("p"))).toBe(true);
  });

  it("ignores incoming offers", () => {
    const incoming = dayPlan({ mine: [task("m")], swaps: { incoming: [offer("o", "m")], outgoing: [] } });
    expect(canOfferFor(incoming, task("o"))).toBe(true);
  });

  it("hides it for my own Task", () => {
    expect(canOfferFor(plan, task("m"))).toBe(false);
  });
});
