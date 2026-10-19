import { describe, expect, it } from "vitest";
import { whenLoadStarts } from "./loadState";

const plan = { kind: "ready", plan: { date: "2026-10-19" } } as never;

describe("whenLoadStarts", () => {
  it("shows loading on the first load", () => {
    expect(whenLoadStarts({ kind: "loading" })).toEqual({ kind: "loading" });
  });

  it("shows loading again on a Retry after a failure", () => {
    expect(whenLoadStarts({ kind: "failed", reason: "error" })).toEqual({ kind: "loading" });
  });

  it("keeps the plan on screen while it reloads after an action", () => {
    expect(whenLoadStarts(plan)).toBe(plan);
  });
});
