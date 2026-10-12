import { CheckInSection } from "../checkin/CheckInSection";
import { energyNote } from "../checkin/state";
import { useCheckIn } from "../checkin/useCheckIn";
import { TodayHeader } from "../dayplan/TodayHeader";
import { TodaySection } from "../dayplan/TodaySection";
import { useDayPlan } from "../dayplan/useDayPlan";

/**
 * Today: the greeting and Energy chip, then the Check-in, then the Day Plan. A saved Check-in can change the
 * plan (the API plans the Resident again), and so can the start choice, so the owner keeps one `version` and the
 * plan reloads whenever it changes, instead of polling. The Check-in stays mounted so its "saved" announcement
 * is not lost. This is the one owner of the plan: the chip and the plan section are both views of it, and share
 * the one Energy note computed here.
 */
export function HomeDay({ version, onPlanChanged }: { version: number; onPlanChanged(): void }) {
  const checkIn = useCheckIn(onPlanChanged);
  const { state, reload } = useDayPlan(version);
  const today = checkIn.state.kind === "ready" ? checkIn.state.checkIn : null;
  const energy = state.kind === "ready" ? state.plan.energy : null;
  const note = today ? energyNote(energy, today) : null;

  return (
    <>
      <TodayHeader energy={energy} note={note} />
      <CheckInSection checkIn={checkIn} />
      <TodaySection state={state} reload={reload} note={note} />
    </>
  );
}
