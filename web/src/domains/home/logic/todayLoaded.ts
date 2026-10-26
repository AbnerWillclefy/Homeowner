/** The part of a read's state this rule looks at: `useCheckIn().state` and `useDayPlan().state` both fit. */
type ReadKind = { kind: "loading" | "failed" | "ready" };

export interface TodayReads {
  checkIn: ReadKind;
  dayPlan: ReadKind;
  /** `useStreak().loading`: true only until the first answer. */
  streakLoading: boolean;
}

/**
 * Whether Today's three reads (Check-in, Day Plan, Streak) have each answered, with data or a failure. A failure
 * is settled: its section shows its own alert in place. Today shows its skeleton until this is true, then
 * everything in one swap, so no section arrives after another and nothing is pushed down.
 */
export function todayLoaded({ checkIn, dayPlan, streakLoading }: TodayReads): boolean {
  return checkIn.kind !== "loading" && dayPlan.kind !== "loading" && !streakLoading;
}
