import { useState } from "react";
import { CheckInSection } from "../checkin/CheckInSection";
import { useCheckIn } from "../checkin/useCheckIn";
import { TodayHeader } from "../dayplan/TodayHeader";
import { TodaySection } from "../dayplan/TodaySection";

/**
 * Today: the greeting and Energy chip, then the Check-in, then the Day Plan. A saved Check-in can change the
 * plan (the API plans the Resident again), and so can the start choice, so the owner keeps one `version` and the
 * plan is remounted, which reloads it, whenever it changes, instead of polling. The Check-in stays mounted so
 * its "saved" announcement is not lost. The plan reports its Energy up for the chip, and reports null while it
 * reloads, so the chip reads "Checked in" rather than flashing "not set".
 */
export function HomeDay({ version, onPlanChanged }: { version: number; onPlanChanged(): void }) {
  const checkIn = useCheckIn(onPlanChanged);
  const [energy, setEnergy] = useState<number | null>(null);
  const today = checkIn.state.kind === "ready" ? checkIn.state.checkIn : null;

  return (
    <>
      <TodayHeader energy={energy} checkIn={today} />
      <CheckInSection checkIn={checkIn} />
      <TodaySection key={version} checkIn={today} onEnergy={setEnergy} />
    </>
  );
}
