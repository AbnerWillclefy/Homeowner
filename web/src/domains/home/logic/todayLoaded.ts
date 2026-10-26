/** The part of a read's state this rule looks at: `useCheckIn().state` and `useDayPlan().state` both fit. */
type ReadKind = { kind: "loading" | "failed" | "ready" };

export interface TodayReads {
  checkIn: ReadKind;
  dayPlan: ReadKind;
}

/**
 * Whether Today's two reads (Check-in and Day Plan) have each answered, with data or a failure. A failure is
 * settled: its section shows its own alert in place. Today shows its skeleton until this is true, then everything
 * in one swap, so no section arrives after another and nothing is pushed down. The Streak is not part of it: it
 * lives in the top bar, which holds its box while the Streak loads.
 */
export function todayLoaded({ checkIn, dayPlan }: TodayReads): boolean {
  return checkIn.kind !== "loading" && dayPlan.kind !== "loading";
}
