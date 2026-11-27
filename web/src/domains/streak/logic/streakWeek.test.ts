import { describe, expect, it } from "vitest";
import type { StreakDay } from "../api/api";
import { weekBadges, weekdayShort, weekSummary } from "./streakWeek";

const week = (...states: StreakDay["state"][]): StreakDay[] => states.map((state, i) => ({ date: `2030-01-${String(9 + i).padStart(2, "0")}`, state }));

describe("weekBadges", () => {
  it("gives each state its tone, and an icon only to paused and broken", () => {
    const badges = weekBadges(week("grew", "paused", "broken", "open"));
    expect(badges.map((b) => [b.state, b.tone, b.icon !== undefined])).toEqual([
      ["grew", "positive", false],
      ["paused", "neutral", true],
      ["broken", "danger", true],
      ["open", "brand", false],
    ]);
  });

  it("keeps the days in order", () => {
    expect(weekBadges(week("grew", "grew", "open")).map((b) => b.date)).toEqual(["2030-01-09", "2030-01-10", "2030-01-11"]);
  });
});

describe("weekSummary", () => {
  it("counts the days that grew and says when today is open", () => {
    expect(weekSummary(week("grew", "grew", "grew", "paused", "grew", "grew", "open"))).toEqual({ count: 5, open: true });
    expect(weekSummary(week("grew", "broken", "grew"))).toEqual({ count: 2, open: false });
  });
});

describe("weekdayShort", () => {
  it.each([
    ["pt-BR", "2030-01-09", "qua"],
    ["pt-BR", "2030-01-12", "sáb"],
    ["en-US", "2030-01-09", "Wed"],
  ])("%s %s is %s, with no trailing dot", (locale, date, expected) => {
    expect(weekdayShort(date, locale)).toBe(expected);
  });
});
