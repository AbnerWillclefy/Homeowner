/**
 * A Baseline is picked as a level and saved as points; the API only ever sees points (0 to 20, MaxBaseline in
 * backend/internal/profile). The numbers and why:
 *
 * - Low 4: above 0 (0 gives no Tasks) and fits a mid-Effort Chore (Effort is 1 to 5; the allocator places a Task when
 *   Energy left >= Effort). A Low Check-in scales it to 4*50/100 = 2 (rounded down), still enough for an Effort 1 or 2
 *   Chore. A Low of 3 would scale to 1.
 * - Normal 8: near the middle of the 0 to 20 range, a few average Chores in a day.
 * - High 14: does not fit everything in one day, and Energized (130%) gives 14*130/100 = 18, under the cap of 20.
 *
 * A saved value from before levels existed (any whole number 0 to 20) shows as the nearest level and is only
 * replaced when the person picks a level. Ties (6 and 11) go to the lower level, so an old value never promises more
 * Energy than it had. A legacy 0 ("nothing that day") therefore shows as Low.
 */
export const BASELINE_LEVELS = ["low", "normal", "high"] as const;

export type BaselineLevel = (typeof BASELINE_LEVELS)[number];

const POINTS: Record<BaselineLevel, number> = { low: 4, normal: 8, high: 14 };

export function levelToPoints(level: BaselineLevel): number {
  return POINTS[level];
}

/** The level nearest to the saved points; null for an unset day. Never "invalid". */
export function pointsToLevel(points: number | null): BaselineLevel | null {
  if (points === null) return null;
  let nearest: BaselineLevel = BASELINE_LEVELS[0];
  for (const level of BASELINE_LEVELS) {
    // Strictly closer wins, so a tie keeps the lower level (the list is in ascending order).
    if (Math.abs(POINTS[level] - points) < Math.abs(POINTS[nearest] - points)) nearest = level;
  }
  return nearest;
}
