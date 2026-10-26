import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation } from "react-router";
import { CheckInDialog } from "../../domains/checkin/components/CheckInDialog";
import { useCheckIn } from "../../domains/checkin/hooks/useCheckIn";
import { energyNote } from "../../domains/checkin/logic/state";
import { dayPlanQuery } from "../../domains/dayplan/api/queries";
import { plannedEffort } from "../../domains/dayplan/logic/plannedEffort";
import { useLaunchStaleTime } from "../../shared/query/useLaunchStaleTime";
import { homeJoined } from "../../domains/home/api/queries";
import { useHome } from "../../domains/home/hooks/useHome";
import { useMe } from "../../domains/profile/hooks/useMe";
import { useResidents } from "../../domains/residents/hooks/useResidents";
import { useStreak } from "../../domains/streak/hooks/useStreak";
import { useI18n } from "../../shared/i18n";
import { useInvite } from "../../domains/invite/components/PendingInviteProvider";
import type { JoinOutcome } from "../../domains/invite/hooks/useJoinInvite";
import { StartChoice } from "../../domains/startchoice/components/StartChoice";
import { lazyNamed } from "../lazyWithReload";
import { BottomNav } from "./BottomNav";
import { LazyDialog } from "./LazyPage";
import { dialogToShow } from "../logic/dialogToShow";
import { PageFrame } from "./PageFrame";
import { useSession } from "./SessionProvider";
import { ShellContext } from "./ShellContext";
import { TopBar } from "./TopBar";
import { TODAY_PATH } from "../logic/routes";
import { useFocusOnNavigate } from "../hooks/useFocusOnNavigate";

// The dialogs load on demand: most launches never show them.
const JoinInvite = lazyNamed(() => import("../../domains/invite/components/JoinInvite"), "JoinInvite");
const RatingStep = lazyNamed(() => import("../../domains/invite/components/RatingStep"), "RatingStep");

/**
 * The app once onboarding is done: the current tab, the bottom nav, and the dialogs over Today. The Home loads
 * here, not above the welcome routes, so it is fresh when the walk ends and never a stale "no Home".
 */
export function Shell() {
  const { t } = useI18n();
  const home = useHome();
  const residents = useResidents(home.state.kind === "ready");
  const me = useMe();
  const streak = useStreak(home.state.kind === "ready");  const hasHome = home.state.kind === "ready";
  // The Check-in, the Day Plan and the Streak are read here on every tab and shared with Today, which reads the
  // same cache entries, so nothing is requested twice. The Day Plan's actions stay in `useDayPlan`, on Today.
  const checkIn = useCheckIn(hasHome);
  const planStaleTime = useLaunchStaleTime(hasHome);
  const planRead = useQuery({ ...dayPlanQuery, enabled: hasHome, staleTime: planStaleTime });
  const plan = planRead.data ?? null;
  const energy = plan?.energy ?? null;
  const checkInToday = checkIn.state.kind === "ready" ? checkIn.state.checkIn : null;
  const note = checkInToday ? energyNote(energy, checkInToday) : null;
  const planned = plannedEffort(plan);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openCheckIn = useCallback((returnFocusTo?: HTMLElement) => {
    returnFocusRef.current = returnFocusTo ?? null;
    setCheckInOpen(true);
  }, []);
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const invite = useInvite();
  const session = useSession();

  // The one owner of "a join ended": the session records it, then the Shell refreshes what it shows.
  const finishJoin = useCallback(
    (outcome: JoinOutcome) => {
      session.recordJoin(outcome);
      // What the Shell cached behind the dialog (the Home and everything under it) is out of date, and the
      // children may belong to another Home: they are reset, not only marked stale, and read again.
      void homeJoined(queryClient);
    },
    [session, queryClient],
  );

  const content = useRef<HTMLDivElement>(null);
  useFocusOnNavigate(content, pathname, t("app.name"));

  // Dialogs wait on the other tabs; a pending Invite sends every path to Today anyway (see resolveRoute).
  const dialog = pathname === TODAY_PATH ? dialogToShow({ inviteToken: invite.token, after: session.after, choosing: session.choosing }) : null;

  return (
    <ShellContext.Provider value={{ home, residents, me, streak, checkIn, note, energy, planned, openCheckIn }}>
      <div className="flex min-h-dvh flex-col">
        <PageFrame className="flex-1" top={<TopBar />}>
          <div ref={content}>
            <Outlet />
          </div>
        </PageFrame>
        <BottomNav />
      </div>
      {dialog === "join" && invite.token !== null && (
        <LazyDialog>
          <JoinInvite token={invite.token} onDismiss={invite.clear} onFinished={finishJoin} />
        </LazyDialog>
      )}
      {dialog === "rating" && (
        <LazyDialog>
          <RatingStep onClose={session.closeRating} />
        </LazyDialog>
      )}
      {dialog === "start-choice" && <StartChoice onDecided={session.decide} />}
      {/* The one Check-in dialog, opened by the pill and by Today's card. Mounted only while open, so the form
          starts again from the saved Check-in each time. */}
      {checkInOpen && checkIn.state.kind === "ready" && (
        <CheckInDialog
          checkIn={checkIn.state.checkIn}
          demands={checkIn.demands}
          save={checkIn.save}
          onClose={() => setCheckInOpen(false)}
          returnFocusRef={returnFocusRef}
        />
      )}
    </ShellContext.Provider>
  );
}
