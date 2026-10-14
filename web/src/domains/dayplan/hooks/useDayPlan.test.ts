import { describe, expect, it } from "vitest";
import type { DayPlan } from "../api/api";
import { outcome } from "./useDayPlan";

const plan = (date: string): DayPlan => ({
  date,
  allocationTime: "07:00",
  planned: true,
  rejected: false,
  allocator: "baseline",
  energy: 5,
  mine: [],
  others: [],
  pool: [],
  doneToday: [],
});

describe("outcome", () => {
  it("shows the plan the server answered with, and says nothing", () => {
    expect(outcome({ kind: "ok", plan: plan("2026-10-11") })).toEqual({ plan: plan("2026-10-11"), notice: null });
  });

  it("keeps the plan and raises an alert for any other failure", () => {
    expect(outcome({ kind: "offline" })).toEqual({ notice: { tone: "alert", keys: ["dayplan.action.failed.offline"] } });
    expect(outcome({ kind: "error" })).toEqual({ notice: { tone: "alert", keys: ["dayplan.action.failed.error"] } });
    expect(outcome({ kind: "none" })).toEqual({ notice: { tone: "alert", keys: ["dayplan.action.failed.error"] } });
  });

  it("takes the fresh plan after a 409 and says what happened", () => {
    expect(
      outcome({ kind: "conflict", code: "not_in_pool" }, { kind: "ok", plan: plan("2026-10-12") }),
    ).toEqual({
      plan: plan("2026-10-12"),
      notice: { tone: "status", keys: ["dayplan.conflict.not_in_pool"] },
    });
  });

  it("alerts with the conflict and the load failure when the refetch after a 409 fails", () => {
    expect(outcome({ kind: "conflict", code: "nope" }, { kind: "offline" })).toEqual({
      notice: { tone: "alert", keys: ["dayplan.conflict.unknown", "dayplan.load.offline"] },
    });
  });
});
