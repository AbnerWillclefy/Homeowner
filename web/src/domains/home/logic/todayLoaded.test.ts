import { describe, expect, it } from "vitest";
import { todayLoaded, type TodayReads } from "./todayLoaded";

const settled: TodayReads = { checkIn: { kind: "ready" }, dayPlan: { kind: "ready" }, streakLoading: false };

describe("todayLoaded", () => {
  it("is true when all three reads have data", () => {
    expect(todayLoaded(settled)).toBe(true);
  });

  it("stays false while the Check-in is on its first load", () => {
    expect(todayLoaded({ ...settled, checkIn: { kind: "loading" } })).toBe(false);
  });

  it("stays false while the Day Plan is on its first load", () => {
    expect(todayLoaded({ ...settled, dayPlan: { kind: "loading" } })).toBe(false);
  });

  it("stays false while the Streak is on its first load", () => {
    expect(todayLoaded({ ...settled, streakLoading: true })).toBe(false);
  });

  it("stays false until the slowest read answers, however many have", () => {
    expect(todayLoaded({ checkIn: { kind: "ready" }, dayPlan: { kind: "ready" }, streakLoading: true })).toBe(false);
    expect(todayLoaded({ checkIn: { kind: "failed" }, dayPlan: { kind: "loading" }, streakLoading: false })).toBe(false);
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

  it("counts a Streak that ended loading with no number as settled", () => {
    expect(todayLoaded({ ...settled, streakLoading: false })).toBe(true);
  });

  it("is true when every read failed", () => {
    expect(todayLoaded({ checkIn: { kind: "failed" }, dayPlan: { kind: "failed" }, streakLoading: false })).toBe(true);
  });
});
