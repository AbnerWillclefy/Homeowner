import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation } from "react-router";
import { ShellCheckInDialog } from "../../domains/checkin/components/ShellCheckInDialog";
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
import { useShellCheckIn } from "../hooks/useShellCheckIn";

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
  const hasHome = home.state.kind === "ready";
  const streak = useStreak(hasHome);
  const { checkIn, note, energy, planned, openCheckIn, openFor, closeCheckIn, latchCheckIn, pillRef, returnFocusRef } = useShellCheckIn(hasHome);
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
  const dialog = dialogToShow({
    onToday: pathname === TODAY_PATH,
    inviteToken: invite.token,
    after: session.after,
    choosing: session.choosing,
    checkIn: checkIn.state.kind === "ready" ? checkIn.state.checkIn : null,
    checkInDismissedFor: session.checkInDismissedFor,
  });

  // The Check-in dialog latches once it shows (set during render, from the same decision), so a refetch cannot close
  // it. Any other dialog takes priority over a latched one. A close dismisses the date the Home reads now: if the day
  // rolled over under the open form, the Resident has seen the new day's prompt, and dismissing only the old date
  // would reopen it the moment they tap "Not now".
  const autoDate = dialog === "checkin" && checkIn.state.kind === "ready" ? checkIn.state.checkIn.date : null;
  if (autoDate !== null && openFor === null) latchCheckIn(autoDate);
  const checkInShown = dialog === "checkin" || (openFor !== null && dialog === null);
  const dismissCheckIn = () => {
    const shownFor = checkIn.state.kind === "ready" ? checkIn.state.checkIn.date : openFor;
    if (shownFor !== null) session.dismissCheckIn(shownFor);
    // The dialog opened by itself has no opener: focus goes back to the pill, the control that reopens it.
    returnFocusRef.current ??= pillRef.current;
    closeCheckIn();
  };

  return (
    <ShellContext.Provider value={{ home, residents, me, streak, checkIn, note, energy, openCheckIn, pillRef }}>
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
      {/* The one Check-in dialog, opened by the pill or by itself on launch. Never two. */}
      <ShellCheckInDialog
        checkIn={checkIn}
        open={checkInShown}
        planned={planned}
        onClose={dismissCheckIn}
        returnFocusRef={returnFocusRef}
      />
    </ShellContext.Provider>
  );
}
