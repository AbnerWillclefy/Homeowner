import { useCallback, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { useHome } from "../../domains/home/hooks/useHome";
import { useMe } from "../../domains/profile/hooks/useMe";
import { useResidents } from "../../domains/residents/hooks/useResidents";
import { useI18n } from "../../shared/i18n";
import { useInvite } from "../../domains/invite/components/PendingInviteProvider";
import { JoinInvite } from "../../domains/invite/components/JoinInvite";
import { RatingStep } from "../../domains/invite/components/RatingStep";
import type { JoinOutcome } from "../../domains/invite/hooks/useJoinInvite";
import { StartChoice } from "../../domains/startchoice/components/StartChoice";
import { BottomNav } from "./BottomNav";
import { dialogToShow } from "../logic/dialogToShow";
import { PageFrame } from "./PageFrame";
import { useSession } from "./SessionProvider";
import { ShellContext } from "./ShellContext";
import { TODAY_PATH } from "../logic/routes";
import { useFocusOnNavigate } from "../hooks/useFocusOnNavigate";

/**
 * The app once onboarding is done: the current tab, the bottom nav, and the dialogs over Today. The Home loads
 * here, not above the welcome routes, so it is fresh when the walk ends and never a stale "no Home".
 */
export function Shell() {
  const { t } = useI18n();
  const home = useHome();
  const residents = useResidents(home.state.kind === "ready");
  const me = useMe();
  const [planVersion, setPlanVersion] = useState(0);
  const planChanged = useCallback(() => setPlanVersion((v) => v + 1), []);
  const { pathname } = useLocation();
  const invite = useInvite();
  const session = useSession();
  const { reload } = home;

  // The one owner of "a join ended": the session records it, then the Shell refreshes what it shows.
  const finishJoin = useCallback(
    (outcome: JoinOutcome) => {
      session.recordJoin(outcome);
      // The Shell fetched the Home behind the dialog; after a join it is out of date.
      void reload();
      planChanged();
    },
    [session, reload, planChanged],
  );

  const content = useRef<HTMLDivElement>(null);
  useFocusOnNavigate(content, pathname, t("app.name"));

  // Dialogs wait on the other tabs; a pending Invite sends every path to Today anyway (see resolveRoute).
  const dialog = pathname === TODAY_PATH ? dialogToShow({ inviteToken: invite.token, after: session.after, choosing: session.choosing }) : null;

  return (
    <ShellContext.Provider value={{ home, residents, me, planVersion, planChanged }}>
      <div className="flex min-h-dvh flex-col">
        <PageFrame className="flex-1">
          <div ref={content}>
            <Outlet />
          </div>
        </PageFrame>
        <BottomNav />
      </div>
      {dialog === "join" && invite.token !== null && (
        <JoinInvite token={invite.token} onDismiss={invite.clear} onFinished={finishJoin} />
      )}
      {dialog === "rating" && <RatingStep onClose={session.closeRating} />}
      {dialog === "start-choice" && <StartChoice onDecided={session.decide} onPlanned={planChanged} />}
    </ShellContext.Provider>
  );
}
