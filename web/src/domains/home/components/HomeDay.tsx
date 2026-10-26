import { useShell } from "../../../app/components/ShellContext";
import { CheckInSection } from "../../checkin/components/CheckInSection";
import { EnergySummary, showsEnergy } from "../../dayplan/components/EnergySummary";
import { TodayHeader } from "../../dayplan/components/TodayHeader";
import { TodaySection } from "../../dayplan/components/TodaySection";
import { useDayPlan } from "../../dayplan/hooks/useDayPlan";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { ReservedSkeleton } from "../../../shared/ui/ReservedSkeleton";
import { useTodayLoaded } from "../hooks/useTodayLoaded";
import { TodaySkeleton } from "./HomeSkeleton";

/**
 * Today: the greeting, then the Check-in card with today's Energy and the Day Plan. All of it arrives in one swap,
 * after the two reads have answered (see
 * `todayLoaded`); before that Today is its skeleton. The folded explanation belongs to the Day Plan: it shows right under "Your Tasks",
 * before the Tasks, and only on a planned day. Whatever changes the plan
 * (an action, a saved Check-in, the start choice, a join) writes or invalidates the query cache, so nothing here
 * tracks a version or polls. This is the one owner of the plan: the Energy
 * summary and the plan section are both views of it. The Check-in, its dialog and the Energy note come from the
 * Shell (`useShell`), which reads them on every tab for the top bar's Energy pill: one owner of the save and one
 * Energy note, shared with the pill.
 */
export function HomeDay() {
  // The Shell owns the Check-in (and its dialog), the Energy note and the planned figure; Today only shows them.
  const { checkIn, note, planned } = useShell();
  const day = useDayPlan();
  const { state } = day;
  // Today's single header slot spins once, whichever of its two reads refreshes over what is on screen. The
  // Streak's refresh is the top bar's, not Today's.
  useReportFetching(day.refreshing || checkIn.refreshing);
  const energy = state.kind === "ready" ? state.plan.energy : null;
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
      <CheckInSection
        checkIn={checkIn}
        energy={showsEnergy(note) ? <EnergySummary note={note} energy={energy ?? 0} planned={planned} /> : null}
      />
      <TodaySection day={day} note={note} />
    </>
  );
}
