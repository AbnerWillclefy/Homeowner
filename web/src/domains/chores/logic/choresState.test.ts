import { describe, expect, it } from "vitest";
import type { QueryViewState } from "../../../shared/query/view";
import type { Chore } from "../api/api";
import { choreListsStateOf, choresStateOf } from "./choresState";

const ready = <T>(data: T): QueryViewState<T> => ({ kind: "ready", data });
const loading: QueryViewState<never> = { kind: "loading" };
const failed = (reason: "offline" | "error" | "not-signed-in"): QueryViewState<never> => ({ kind: "failed", reason });
const CHORES: Chore[] = [];

describe("choresStateOf", () => {
  it("is ready with all three", () => {
    expect(choresStateOf(ready(["kitchen"]), ready(["heavy"]), ready(CHORES))).toEqual({
      kind: "ready",
      categories: ["kitchen"],
      demands: ["heavy"],
      chores: CHORES,
    });
  });

  it("is loading while any of the three is loading, even if another failed", () => {
    expect(choresStateOf(loading, ready([]), ready(CHORES))).toEqual({ kind: "loading" });
    expect(choresStateOf(ready([]), ready([]), loading)).toEqual({ kind: "loading" });
    expect(choresStateOf(failed("error"), ready([]), loading)).toEqual({ kind: "loading" });
  });

  it("fails with the first failure in the order categories, demands, chores", () => {
    expect(choresStateOf(failed("offline"), failed("error"), failed("error"))).toEqual({
      kind: "failed",
      reason: "offline",
    });
    expect(choresStateOf(ready([]), failed("error"), failed("offline"))).toEqual({ kind: "failed", reason: "error" });
    expect(choresStateOf(ready([]), ready([]), failed("not-signed-in"))).toEqual({
      kind: "failed",
      reason: "not-signed-in",
    });
  });
});

describe("choreListsStateOf", () => {
  it("is ready with both lists", () => {
    expect(choreListsStateOf(ready(["kitchen"]), ready(["heavy"]))).toEqual({
      kind: "ready",
      categories: ["kitchen"],
      demands: ["heavy"],
    });
  });

  it("is loading while either is loading, and fails with categories first", () => {
    expect(choreListsStateOf(ready([]), loading)).toEqual({ kind: "loading" });
    expect(choreListsStateOf(failed("offline"), failed("error"))).toEqual({ kind: "failed", reason: "offline" });
    expect(choreListsStateOf(ready([]), failed("error"))).toEqual({ kind: "failed", reason: "error" });
  });
});
