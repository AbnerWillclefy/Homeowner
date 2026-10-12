import { CheckInSection } from "../checkin/CheckInSection";
import { useCheckIn } from "../checkin/useCheckIn";
import { TodaySection } from "../dayplan/TodaySection";

/**
 * Today's Check-in above today's Day Plan. A saved Check-in can change the plan (the API plans the Resident
 * again), and so can the start choice, so the owner keeps one `version` and Today is remounted, which reloads
 * it, whenever it changes, instead of polling.
 */
export function HomeDay({ version, onPlanChanged }: { version: number; onPlanChanged(): void }) {
  const checkIn = useCheckIn(onPlanChanged);
  const level = checkIn.state.kind === "ready" ? checkIn.state.checkIn.level : null;

  return (
    <>
      <CheckInSection checkIn={checkIn} />
      <TodaySection key={version} level={level} />
    </>
  );
}
