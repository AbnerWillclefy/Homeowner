import { describe, expect, it } from "vitest";
import { actionsFor } from "./actions";

const TASK = { people: 1, committed: false };

describe("actionsFor", () => {
  it("offers Done, Refuse and Accept on a Proposed Task of your own", () => {
    expect(actionsFor(TASK, "mine")).toEqual({ actions: ["done", "refuse", "accept"], committed: false });
  });

  it("treats a Task without a committed flag (an older API) as Proposed", () => {
    expect(actionsFor({ people: 1 }, "mine")).toEqual({ actions: ["done", "refuse", "accept"], committed: false });
  });

  it("offers only Done, and the Committed label, on a Committed Task of your own", () => {
    expect(actionsFor({ people: 1, committed: true }, "mine")).toEqual({ actions: ["done"], committed: true });
  });

  it("offers Take on a pool Task", () => {
    expect(actionsFor(TASK, "pool")).toEqual({ actions: ["take"], committed: false });
  });

  it("hides Take on a two-person pool Task, which the API refuses until it is supported", () => {
    expect(actionsFor({ people: 2, committed: false }, "pool")).toEqual({ actions: [], committed: false });
  });

  it("offers nothing on another Resident's Task, Committed or not, and shows no label", () => {
    expect(actionsFor(TASK, "other")).toEqual({ actions: [], committed: false });
    expect(actionsFor({ people: 1, committed: true }, "other")).toEqual({ actions: [], committed: false });
  });

  it("still offers Done, Refuse and Accept on a two-person Task of your own", () => {
    expect(actionsFor({ people: 2, committed: false }, "mine").actions).toEqual(["done", "refuse", "accept"]);
  });
});
