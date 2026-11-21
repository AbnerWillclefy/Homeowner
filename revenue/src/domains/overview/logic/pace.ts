import type { Pace } from "../api/api";

export interface PaceView {
  /** Cumulative spend per day, days counted from 1. */
  points: { day: number; cents: number }[];
  /** How far today's spend is from the straight line, never negative. */
  gapCents: number;
  over: boolean;
}

/** The line runs from 0 on day 1 to `lineEndCents` on the last day; "over" is strictly above it. */
export function paceView(pace: Pace, days: number): PaceView {
  const points = pace.spentCents.map((cents, i) => ({ day: i + 1, cents }));
  const last = points.at(-1);
  if (!last) return { points, gapCents: 0, over: false };
  const line = Math.round((pace.lineEndCents * (last.day - 1)) / Math.max(days - 1, 1));
  return { points, gapCents: Math.abs(last.cents - line), over: last.cents > line };
}
