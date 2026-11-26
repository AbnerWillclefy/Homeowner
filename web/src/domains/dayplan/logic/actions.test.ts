import { describe, expect, it } from "vitest";
import { actionsFor, pendingAction, pendingSwap } from "./actions";

const TASK = { people: 1, committed: false };

describe("actionsFor", () => {
  it("gives a Proposed Task of your own Recusar then Aceitar in the primary area, with no Done", () => {
    const actions = actionsFor(TASK, "mine");
    expect(actions).toEqual({ primary: ["refuse", "accept"], menu: [], committed: false });
    expect([...actions.primary, ...actions.menu]).not.toContain("done");
  });

  it("treats a Task without a committed flag (an older API) as Proposed", () => {
    expect(actionsFor({ people: 1 }, "mine")).toEqual({ primary: ["refuse", "accept"], menu: [], committed: false });
  });

  it("gives a Committed Task of your own one action, Concluir, and marks it Committed", () => {
    expect(actionsFor({ people: 1, committed: true }, "mine")).toEqual({ primary: ["done"], menu: [], committed: true });
  });

  it("gives a pool Task Pegar as its one action and the one-step Done in the menu", () => {
    expect(actionsFor(TASK, "pool")).toEqual({ primary: ["take"], menu: ["done"], committed: false });
  });

  it("gives a two-person pool Task nothing, which the API refuses until it is supported", () => {
    expect(actionsFor({ people: 2, committed: false }, "pool")).toEqual({ primary: [], menu: [], committed: false });
  });

  it("gives another Resident's Task nothing, Committed or not", () => {
    const none = { primary: [], menu: [], committed: false };
    expect(actionsFor(TASK, "other")).toEqual(none);
    expect(actionsFor({ people: 1, committed: true }, "other")).toEqual(none);
  });

  it("puts Swap alone in the menu of another Resident's Task when a Swap can be offered", () => {
    expect(actionsFor(TASK, "other", { canSwap: true })).toEqual({ primary: [], menu: ["swap"], committed: false });
  });

  it("never adds Swap to your own Tasks or the pool, whatever canSwap says", () => {
    for (const role of ["mine", "pool"] as const) {
      expect(actionsFor(TASK, role, { canSwap: true })).toEqual(actionsFor(TASK, role));
    }
  });

  it("gives a two-person Task of your own the same actions as a one-person one", () => {
    expect(actionsFor({ people: 2, committed: false }, "mine")).toEqual(actionsFor(TASK, "mine"));
    expect(actionsFor({ people: 2, committed: true }, "mine")).toEqual(
      actionsFor({ people: 1, committed: true }, "mine"),
    );
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

describe("Swap actions in flight", () => {
  const swapActions = [
    { action: "offerSwap", offeredTaskId: "a", requestedTaskId: "b" },
    { action: "acceptSwap", swapId: "a" },
    { action: "declineSwap", swapId: "a" },
    { action: "cancelSwap", swapId: "a" },
  ] as const;

  it.each(swapActions)("makes no Task card spin for $action, even one named like its Task", (acting) => {
    for (const id of ["a", "b", "x"]) expect(pendingAction(acting, id)).toBeNull();
  });

  it("gives an offer its own action and no other offer", () => {
    expect(pendingSwap({ action: "acceptSwap", swapId: "s1" }, "s1")).toBe("acceptSwap");
    expect(pendingSwap({ action: "declineSwap", swapId: "s1" }, "s1")).toBe("declineSwap");
    expect(pendingSwap({ action: "cancelSwap", swapId: "s1" }, "s1")).toBe("cancelSwap");
    expect(pendingSwap({ action: "cancelSwap", swapId: "s1" }, "s2")).toBeNull();
  });

  it("gives an offer nothing for Task actions, offering, Accept all or no action", () => {
    expect(pendingSwap({ taskId: "s1", action: "accept" }, "s1")).toBeNull();
    expect(pendingSwap({ taskId: null, action: "acceptAll" }, "s1")).toBeNull();
    expect(pendingSwap({ action: "offerSwap", offeredTaskId: "s1", requestedTaskId: "s1" }, "s1")).toBeNull();
    expect(pendingSwap(null, "s1")).toBeNull();
  });
});
