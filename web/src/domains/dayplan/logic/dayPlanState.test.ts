import { describe, expect, it } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { viewOf } from "../../../shared/query/view";
import { dayPlan } from "../testing/fixtures";
import type { DayPlan } from "../api/api";
import { dayPlanStateOf } from "./dayPlanState";

const PLAN = dayPlan({ energy: 3 });
const view = (snapshot: { data: DayPlan | null | undefined; error: unknown; isFetching: boolean }) =>
  dayPlanStateOf(viewOf(snapshot).state);

describe("dayPlanStateOf", () => {
  it("is loading on a first load and during a Retry", () => {
    expect(view({ data: undefined, error: null, isFetching: true })).toEqual({ kind: "loading" });
    expect(view({ data: undefined, error: new ApiFailure("error"), isFetching: true })).toEqual({ kind: "loading" });
  });

  it("is ready with the cached plan, also while it refetches", () => {
    expect(view({ data: PLAN, error: null, isFetching: false })).toEqual({ kind: "ready", plan: PLAN });
    expect(view({ data: PLAN, error: null, isFetching: true })).toEqual({ kind: "ready", plan: PLAN });
  });

  it("keeps the plan on screen, with no alert, when a background refetch failed", () => {
    expect(view({ data: PLAN, error: new ApiFailure("offline"), isFetching: false })).toEqual({ kind: "ready", plan: PLAN });
  });

  it("fails a first load with the reason of the failure", () => {
    expect(view({ data: undefined, error: new ApiFailure("offline"), isFetching: false })).toEqual({
      kind: "failed",
      reason: "offline",
    });
    expect(view({ data: undefined, error: new ApiFailure("not-signed-in"), isFetching: false })).toEqual({
      kind: "failed",
      reason: "not-signed-in",
    });
  });

  it("fails with none when the caller has no Home (null data)", () => {
    expect(view({ data: null, error: null, isFetching: false })).toEqual({ kind: "failed", reason: "none" });
  });
});
