import { useState } from "react";
import { CheckInSection } from "../checkin/CheckInSection";
import { useCheckIn } from "../checkin/useCheckIn";
import { TodaySection } from "../dayplan/TodaySection";

/**
 * Today's Check-in above today's Day Plan. A saved Check-in can change the plan (the API plans the Resident
 * again), so the Today section is remounted, which reloads it, instead of polling.
 */
export function HomeDay() {
  const [planVersion, setPlanVersion] = useState(0);
  const checkIn = useCheckIn(() => setPlanVersion((v) => v + 1));
  const level = checkIn.state.kind === "ready" ? checkIn.state.checkIn.level : null;

  return (
    <>
      <CheckInSection checkIn={checkIn} />
      <TodaySection key={planVersion} level={level} />
    </>
  );
}
