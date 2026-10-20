import { useState } from "react";
import { CheckInSection } from "../../checkin/components/CheckInSection";
import { energyNote } from "../../checkin/logic/state";
import { useCheckIn } from "../../checkin/hooks/useCheckIn";
import { DaySummary } from "../../dayplan/components/DaySummary";
import { EnergySummary, showsEnergy } from "../../dayplan/components/EnergySummary";
import { ReplanControl } from "../../dayplan/components/ReplanControl";
import { TodayHeader } from "../../dayplan/components/TodayHeader";
import { TodaySection } from "../../dayplan/components/TodaySection";
import { useDayPlan } from "../../dayplan/hooks/useDayPlan";
import { StreakCard } from "../../streak/components/StreakCard";
import { useStreak } from "../../streak/hooks/useStreak";

/**
 * Today: the greeting, then the Check-in card with today's Energy, then the Day Plan. A saved Check-in can change
 * the plan (the API plans the Resident again), and so can the start choice, so the owner keeps one `version`
 * and the plan reloads whenever it changes, instead of polling. This is the one owner of the plan: the Energy
 * summary and the plan section are both views of it, and share the one Energy note computed here. It also owns
 * whether the Check-in dialog is open. That flag is local, not
 * `app/dialogToShow.ts`: the Check-in is the Resident's own choice, not a session-wide flow to queue.
 */
export function HomeDay({ version, onPlanChanged }: { version: number; onPlanChanged(): void }) {
  const checkIn = useCheckIn(onPlanChanged);
  const day = useDayPlan(version);
  const { state } = day;
  const streak = useStreak(`${version}:${day.settled}`);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const today = checkIn.state.kind === "ready" ? checkIn.state.checkIn : null;
  const energy = state.kind === "ready" ? state.plan.energy : null;
  const note = today ? energyNote(energy, today) : null;
  const planned = state.kind === "ready" ? state.plan.mine.reduce((sum, task) => sum + task.currentEffort, 0) : 0;

  return (
    <>
      <TodayHeader />
      <CheckInSection
        checkIn={checkIn}
        open={checkInOpen}
        onOpen={() => setCheckInOpen(true)}
        onClose={() => setCheckInOpen(false)}
        energy={showsEnergy(note) ? <EnergySummary note={note} energy={energy ?? 0} planned={planned} /> : null}
      />
      {state.kind === "ready" ? <DaySummary plan={state.plan} /> : null}
      <StreakCard streak={streak.streak} loading={streak.loading} />
      <ReplanControl plan={state.kind === "ready" ? state.plan : undefined} show={day.show} />
      <TodaySection day={day} note={note} />
    </>
  );
}
