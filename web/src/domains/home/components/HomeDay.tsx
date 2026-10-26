import { useState } from "react";
import { CheckInSection } from "../../checkin/components/CheckInSection";
import { energyNote } from "../../checkin/logic/state";
import { useCheckIn } from "../../checkin/hooks/useCheckIn";
import { EnergySummary, showsEnergy } from "../../dayplan/components/EnergySummary";
import { ReplanControl } from "../../dayplan/components/ReplanControl";
import { TodayHeader } from "../../dayplan/components/TodayHeader";
import { TodaySection } from "../../dayplan/components/TodaySection";
import { useDayPlan } from "../../dayplan/hooks/useDayPlan";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { ReservedSkeleton } from "../../../shared/ui/ReservedSkeleton";
import { useTodayLoaded } from "../hooks/useTodayLoaded";
import { TodaySkeleton } from "./HomeSkeleton";

/**
 * Today: the greeting, then the replan control (staging only, high on the page so the
 * sticky bottom nav is not over it when Today loads), the Check-in card with today's Energy and the Day Plan. All of it arrives in one swap, after the three reads have answered (see
 * `todayLoaded`); before that Today is its skeleton. The folded explanation belongs to the Day Plan: it shows right under "Your Tasks",
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
  // Today's single header slot spins once, whichever of its two reads refreshes over what is on screen. The
  // Streak's refresh is the top bar's, not Today's.
  useReportFetching(day.refreshing || checkIn.refreshing);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const today = checkIn.state.kind === "ready" ? checkIn.state.checkIn : null;
  const energy = state.kind === "ready" ? state.plan.energy : null;
  const note = today ? energyNote(energy, today) : null;
  const planned = state.kind === "ready" ? state.plan.mine.reduce((sum, task) => sum + task.currentEffort, 0) : 0;
  // One swap: until each of the two reads has answered (data or failure) Today is its skeleton, which holds the
  // final layout's space from the first frame and shows after the page's 300ms. Then the header and every section
  // arrive in the same render. The sections' own first-load skeletons therefore never draw on mount; they still
  // draw for a Retry after a failure.
  const loaded = useTodayLoaded({ checkIn: checkIn.state, dayPlan: state });
  const showSkeleton = useReportFirstLoad(!loaded);

  if (!loaded) {
    return (
      <ReservedSkeleton show={showSkeleton}>
        <TodaySkeleton />
      </ReservedSkeleton>
    );
  }

  return (
    <>
      <TodayHeader />
      <ReplanControl plan={state.kind === "ready" ? state.plan : undefined} show={day.show} />
      <CheckInSection
        checkIn={checkIn}
        open={checkInOpen}
        onOpen={() => setCheckInOpen(true)}
        onClose={() => setCheckInOpen(false)}
        energy={showsEnergy(note) ? <EnergySummary note={note} energy={energy ?? 0} planned={planned} /> : null}
      />
      <TodaySection day={day} note={note} />
    </>
  );
}
