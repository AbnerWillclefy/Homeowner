import { describe, expect, it } from "vitest";
import { nextCacheClear, type AuthKind } from "./cacheClear";

function run(kinds: AuthKind[]) {
  let hadSession = false;
  return kinds.map((kind) => {
    const step = nextCacheClear(hadSession, kind);
    hadSession = step.hadSession;
    return step.clear;
  });
}

describe("nextCacheClear", () => {
  it("does not clear on the first launch moving from loading to signed-out", () => {
    expect(run(["loading", "signed-out"])).toEqual([false, false]);
  });

  it("clears when signed-in moves to signed-out", () => {
    expect(run(["loading", "signed-in", "signed-out"])).toEqual([false, false, true]);
  });

  it("clears when a session passes through loading on its way to signed-out", () => {
    expect(run(["signed-out", "loading", "signed-in", "loading", "signed-out"])).toEqual([false, false, false, false, true]);
  });

  it("clears once per session, not on every signed-out render", () => {
    expect(run(["signed-in", "signed-out", "signed-out"])).toEqual([false, true, false]);
  });

  it("clears again after a second session ends", () => {
    expect(run(["signed-in", "signed-out", "signed-in", "signed-out"])).toEqual([false, true, false, true]);
  });
});
