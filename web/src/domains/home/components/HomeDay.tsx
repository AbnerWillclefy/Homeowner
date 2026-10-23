import { useState } from "react";
import { CheckInSection } from "../../checkin/components/CheckInSection";
import { energyNote } from "../../checkin/logic/state";
import { useCheckIn } from "../../checkin/hooks/useCheckIn";
import { EnergySummary, showsEnergy } from "../../dayplan/components/EnergySummary";
import { ReplanControl } from "../../dayplan/components/ReplanControl";
import { TodayHeader } from "../../dayplan/components/TodayHeader";
import { TodaySection } from "../../dayplan/components/TodaySection";
import { useDayPlan } from "../../dayplan/hooks/useDayPlan";
import { StreakButton } from "../../streak/components/StreakButton";
import { useStreak } from "../../streak/hooks/useStreak";
import { useReportFetching } from "../../../shared/ui/PageLoading";

/**
 * Today: the greeting with the Streak flame button at the end of its row (built here and passed to the header, so
 * the Day Plan domain never imports the Streak), then the Check-in card with today's Energy, the replan control
 * (staging only) and the Day Plan. The folded explanation belongs to the Day Plan: it shows right under "Your Tasks",
 * before the Tasks, and only on a planned day. Whatever changes the plan
 * (an action, a saved Check-in, the start choice, a join) writes or invalidates the query cache, so nothing here
 * tracks a version or polls. This is the one owner of the plan: the Energy
 * summary and the plan section are both views of it, and share the one Energy note computed here. It also owns
 * whether the Check-in dialog is open. That flag is local, not
 * `app/dialogToShow.ts`: the Check-in is the Resident's own choice, not a session-wide flow to queue.
 */
export function HomeDay() {
  const checkIn = useCheckIn();
  const day = useDayPlan();
  const { state } = day;
  const streak = useStreak();
  // Today's single header slot spins once, whichever of the three reads refreshes over what is on screen.
  useReportFetching(day.refreshing || checkIn.refreshing || streak.refreshing);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const today = checkIn.state.kind === "ready" ? checkIn.state.checkIn : null;
  const energy = state.kind === "ready" ? state.plan.energy : null;
  const note = today ? energyNote(energy, today) : null;
  const planned = state.kind === "ready" ? state.plan.mine.reduce((sum, task) => sum + task.currentEffort, 0) : 0;

  return (
    <>
      <TodayHeader aside={<StreakButton streak={streak.streak} loading={streak.loading} />} />
      <CheckInSection
        checkIn={checkIn}
        open={checkInOpen}
        onOpen={() => setCheckInOpen(true)}
        onClose={() => setCheckInOpen(false)}
        energy={showsEnergy(note) ? <EnergySummary note={note} energy={energy ?? 0} planned={planned} /> : null}
      />
      <ReplanControl plan={state.kind === "ready" ? state.plan : undefined} show={day.show} />
      <TodaySection day={day} note={note} />
    </>
  );
}
