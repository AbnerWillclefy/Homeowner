import { useRef } from "react";
import { useShell } from "../../../app/components/ShellContext";
import { TodayHero } from "../../dayplan/components/TodayHero";
import { TodaySection } from "../../dayplan/components/TodaySection";
import { useDayPlan } from "../../dayplan/hooks/useDayPlan";
import { useI18n } from "../../../shared/i18n";
import { TabBody } from "../../../app/components/TabBody";
import { TabHeader } from "../../../app/components/TabHeader";
import { TodayTools } from "../../../app/components/TodayTools";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { ReservedSkeleton } from "../../../shared/ui/ReservedSkeleton";
import { useTodayLoaded } from "../hooks/useTodayLoaded";
import { DayPlanSkeleton, HeroSkeleton } from "../../dayplan/components/DayPlanSkeleton";
import { formatDayTitle } from "../../dayplan/logic/format";

// A stable id: it names the plan section, and the e2e specs look for focus on it.
const HEADING_ID = "today-heading";

/**
 * Today: "Today" over the plan's date, with the Streak and mic as tools, the hero card (Energy, "N de M feitas", or the Energy question before the Check-in), the day's one-line summary, then the Task cards. The header is always
 * there; the summary and the cards arrive in one swap, after the two reads have answered (see `todayLoaded`); before that they are a skeleton. The Check-in is
 * read here only because the empty list's reason comes from its Energy note: the Check-in itself is the hero card's and the Shell's dialog. Whatever changes the plan (an action, a saved Check-in, the start choice,
 * a join) writes or invalidates the query cache, so nothing here tracks a version or polls. The page header
 * is the tab's first heading, so focus lands on it when the tab opens, and it names the plan section.
 */
export function HomeDay() {
  const { t, locale } = useI18n();
  // The Shell owns the Check-in (and its dialog) and the Energy note; Today only reads them.
  const { checkIn, note } = useShell();
  const day = useDayPlan();
  const { state } = day;
  const heading = useRef<HTMLHeadingElement>(null);
  // Today's single header slot spins once, whichever of its two reads refreshes over what is on screen. The
  // Streak's refresh is the Shell's, not Today's.
  useReportFetching(day.refreshing || checkIn.refreshing);
  // One swap: until each of the two reads has answered (data or failure) Today shows a skeleton, which holds the
  // final layout's space from the first frame and shows after the page's 300ms. Then every section
  // arrives in the same render. The sections' own first-load skeletons therefore never draw on mount; they still
  // draw for a Retry after a failure.
  const loaded = useTodayLoaded({ checkIn: checkIn.state, dayPlan: state });
  const showSkeleton = useReportFirstLoad(!loaded);

  // The header is there from the first frame, so the Streak and mic are in their slots while the reads are
  // out, and nothing in it moves when they answer.
  // The plan's date is today in the Home's zone, never the device's.
  const header = (
    <TabHeader
      id={HEADING_ID}
      headingRef={heading}
      title={t("nav.today")}
      subtitle={state.kind === "ready" ? formatDayTitle(state.plan.date, locale) : undefined}
      tools={<TodayTools />}
    />
  );

  if (!loaded) {
    return (
      <>
        {header}
        <TabBody>
          <ReservedSkeleton show={showSkeleton}>
            <HeroSkeleton />
            <DayPlanSkeleton summary />
          </ReservedSkeleton>
        </TabBody>
      </>
    );
  }

  return (
    <>
      {header}
      <TabBody>
        <TodayHero plan={state.kind === "ready" ? state.plan : null} />
        <TodaySection day={day} note={note} headingId={HEADING_ID} headingRef={heading} />
      </TabBody>
    </>
  );
}
