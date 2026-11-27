import { CircleX, Pause, type LucideIcon } from "lucide-react";
import type { StreakDay } from "../api/api";

/** One badge of the week strip. The words (the weekday, or "hoje") always carry the meaning; the icon repeats it. */
export interface WeekBadge {
  date: string;
  state: StreakDay["state"];
  tone: "positive" | "neutral" | "danger" | "brand";
  icon?: LucideIcon;
}

// Broken days are history, the strip's only danger mark (ADR 0003). A day that is still open is today.
const BADGES = {
  grew: { tone: "positive" },
  paused: { tone: "neutral", icon: Pause },
  broken: { tone: "danger", icon: CircleX },
  open: { tone: "brand" },
} as const satisfies Record<StreakDay["state"], Pick<WeekBadge, "tone" | "icon">>;

export const weekBadges = (week: StreakDay[]): WeekBadge[] => week.map(({ date, state }) => ({ date, state, ...BADGES[state] }));

/** A short weekday of a calendar day, "qua": the day is already the Home's local one, so no zone shifts it. */
export function weekdayShort(date: string, locale: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d)).replace(/\.$/, "");
}

/** What the strip sums up for a screen reader: how many days grew, and whether today is still open. */
export const weekSummary = (week: StreakDay[]) => ({ count: week.filter((d) => d.state === "grew").length, open: week.some((d) => d.state === "open") });
