import { describe, expect, it } from "vitest";
import { actionsFor, pendingAction, variantFor } from "./actions";

const TASK = { people: 1, committed: false };

describe("actionsFor", () => {
  it("puts Refuse at the start and Accept at the end of a Proposed Task of your own, with no Done", () => {
    const slots = actionsFor(TASK, "mine");
    expect(slots).toEqual({ start: ["refuse"], end: ["accept"], committed: false });
    expect([...slots.start, ...slots.end]).not.toContain("done");
  });

  it("treats a Task without a committed flag (an older API) as Proposed", () => {
    expect(actionsFor({ people: 1 }, "mine")).toEqual({ start: ["refuse"], end: ["accept"], committed: false });
  });

  it("puts the Committed mark at the start and Done at the end of a Committed Task of your own", () => {
    expect(actionsFor({ people: 1, committed: true }, "mine")).toEqual({ start: [], end: ["done"], committed: true });
  });

  it("offers Take at the end of a pool Task", () => {
    expect(actionsFor(TASK, "pool")).toEqual({ start: [], end: ["take"], committed: false });
  });

  it("hides Take on a two-person pool Task, which the API refuses until it is supported", () => {
    expect(actionsFor({ people: 2, committed: false }, "pool")).toEqual({ start: [], end: [], committed: false });
  });

  it("offers nothing on another Resident's Task, Committed or not, and shows no mark", () => {
    const none = { start: [], end: [], committed: false };
    expect(actionsFor(TASK, "other")).toEqual(none);
    expect(actionsFor({ people: 1, committed: true }, "other")).toEqual(none);
  });

  it("gives a two-person Task of your own the same slots as a one-person one", () => {
    expect(actionsFor({ people: 2, committed: false }, "mine")).toEqual(actionsFor(TASK, "mine"));
    expect(actionsFor({ people: 2, committed: true }, "mine")).toEqual(
      actionsFor({ people: 1, committed: true }, "mine"),
    );
  });
});

describe("variantFor", () => {
  it("is primary at the end and secondary at the start", () => {
    expect(variantFor("end")).toBe("primary");
    expect(variantFor("start")).toBe("secondary");
  });
});

describe("pendingAction", () => {
  it("gives the matching card its action", () => {
    expect(pendingAction({ taskId: "a", action: "accept" }, "a")).toBe("accept");
  });

  it("gives another card nothing", () => {
    expect(pendingAction({ taskId: "a", action: "accept" }, "b")).toBeNull();
  });

  it("gives every card nothing while Accept all runs", () => {
    expect(pendingAction({ taskId: null, action: "acceptAll" }, "a")).toBeNull();
  });

  it("gives nothing when no action runs", () => {
    expect(pendingAction(null, "a")).toBeNull();
  });
});
