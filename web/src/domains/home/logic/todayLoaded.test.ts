import { describe, expect, it } from "vitest";
import { todayLoaded, type TodayReads } from "./todayLoaded";

const settled: TodayReads = { checkIn: { kind: "ready" }, dayPlan: { kind: "ready" } };

describe("todayLoaded", () => {
  it("is true when both reads have data", () => {
    expect(todayLoaded(settled)).toBe(true);
  });

  it("stays false while the Check-in is on its first load", () => {
    expect(todayLoaded({ ...settled, checkIn: { kind: "loading" } })).toBe(false);
  });

  it("stays false while the Day Plan is on its first load", () => {
    expect(todayLoaded({ ...settled, dayPlan: { kind: "loading" } })).toBe(false);
  });

  it("does not wait for the Streak: it lives in the top bar, not in Today", () => {
    // A stray field (an old caller passing the Streak's loading flag) changes nothing.
    expect(todayLoaded({ ...settled, streakLoading: true } as TodayReads)).toBe(true);
  });

  it("stays false until the slowest read answers", () => {
    expect(todayLoaded({ checkIn: { kind: "loading" }, dayPlan: { kind: "ready" } })).toBe(false);
    expect(todayLoaded({ checkIn: { kind: "failed" }, dayPlan: { kind: "loading" } })).toBe(false);
  });

  it("counts a failed Check-in as settled", () => {
    expect(todayLoaded({ ...settled, checkIn: { kind: "failed" } })).toBe(true);
  });

  it("counts a failed Day Plan as settled, whatever the reason", () => {
    // The reason is not part of the rule; the real states carry one of these.
    for (const reason of ["network", "server", "not-signed-in", "none"]) {
      const dayPlan = { kind: "failed" as const, reason };
      expect(todayLoaded({ ...settled, dayPlan })).toBe(true);
    }
  });

  it("is true when every read failed", () => {
    expect(todayLoaded({ checkIn: { kind: "failed" }, dayPlan: { kind: "failed" } })).toBe(true);
  });
});
