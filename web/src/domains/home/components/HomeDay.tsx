import { useId, useRef } from "react";
import { useShell } from "../../../app/components/ShellContext";
import { TodaySection } from "../../dayplan/components/TodaySection";
import { useDayPlan } from "../../dayplan/hooks/useDayPlan";
import { useI18n } from "../../../shared/i18n";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { ReservedSkeleton } from "../../../shared/ui/ReservedSkeleton";
import { useTodayLoaded } from "../hooks/useTodayLoaded";
import { TodaySkeleton } from "./HomeSkeleton";

/**
 * Today: "Your Tasks" with its count, the day's one-line summary, then the Task cards. All of it arrives in one
 * swap, after the two reads have answered (see `todayLoaded`); before that Today is its skeleton. The Check-in is
 * read here only because the empty list's reason comes from its Energy note: the Check-in itself is the top
 * bar's pill and the Shell's dialog. Whatever changes the plan (an action, a saved Check-in, the start choice,
 * a join) writes or invalidates the query cache, so nothing here tracks a version or polls. The page header
 * is the tab's first heading, so focus lands on it when the tab opens, and it names the plan section.
 */
export function HomeDay() {
  const { t } = useI18n();
  // The Shell owns the Check-in (and its dialog) and the Energy note; Today only reads them.
  const { checkIn, note } = useShell();
  const day = useDayPlan();
  const { state } = day;
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  // Today's single header slot spins once, whichever of its two reads refreshes over what is on screen. The
  // Streak's refresh is the top bar's, not Today's.
  useReportFetching(day.refreshing || checkIn.refreshing);
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
      <PageHeader
        id={headingId}
        headingRef={heading}
        tight
        title={t("dayplan.mine.heading")}
        count={state.kind === "ready" && state.plan.planned ? state.plan.mine.length : undefined}
      />
      <TodaySection day={day} note={note} headingId={headingId} headingRef={heading} />
    </>
  );
}
