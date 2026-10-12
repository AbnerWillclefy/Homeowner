import { useState } from "react";
import { CheckInSection } from "../checkin/CheckInSection";
import { energyNote } from "../checkin/state";
import { useCheckIn } from "../checkin/useCheckIn";
import { TodayHeader } from "../dayplan/TodayHeader";
import { TodaySection } from "../dayplan/TodaySection";
import { useDayPlan } from "../dayplan/useDayPlan";

/**
 * Today: the greeting and Energy chip, then the Check-in row, then the Day Plan. A saved Check-in can change
 * the plan (the API plans the Resident again), and so can the start choice, so the owner keeps one `version`
 * and the plan reloads whenever it changes, instead of polling. This is the one owner of the plan: the chip and
 * the plan section are both views of it, and share the one Energy note computed here. It also owns whether the
 * Check-in dialog is open, because the row's button and the Energy chip both open it. That flag is local, not
 * `app/dialogToShow.ts`: the Check-in is the Resident's own choice, not a session-wide flow to queue.
 */
export function HomeDay({ version, onPlanChanged }: { version: number; onPlanChanged(): void }) {
  const checkIn = useCheckIn(onPlanChanged);
  const { state, reload } = useDayPlan(version);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const today = checkIn.state.kind === "ready" ? checkIn.state.checkIn : null;
  const energy = state.kind === "ready" ? state.plan.energy : null;
  const note = today ? energyNote(energy, today) : null;

  return (
    <>
      {/* The chip can open the dialog only once the Check-in is known (note is null until then). */}
      <TodayHeader energy={energy} note={note} onOpenCheckIn={() => setCheckInOpen(true)} />
      <CheckInSection
        checkIn={checkIn}
        open={checkInOpen}
        onOpen={() => setCheckInOpen(true)}
        onClose={() => setCheckInOpen(false)}
      />
      <TodaySection state={state} reload={reload} note={note} />
    </>
  );
}
