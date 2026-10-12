import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { useHome } from "../home/useHome";
import { useInvite } from "../invite/PendingInviteProvider";
import { JoinInvite } from "../invite/JoinInvite";
import { RatingStep } from "../invite/RatingStep";
import type { JoinOutcome } from "../invite/useJoinInvite";
import { StartChoice } from "../startchoice/StartChoice";
import { BottomNav } from "./BottomNav";
import { dialogToShow } from "./dialogToShow";
import { PageFrame } from "./PageFrame";
import { useSession } from "./SessionProvider";
import { ShellContext } from "./ShellContext";
import { TODAY_PATH } from "./routes";

/**
 * The app once onboarding is done: the current tab, the bottom nav, and the dialogs over Today. The Home loads
 * here, not above the welcome routes, so it is fresh when the walk ends and never a stale "no Home".
 */
export function Shell() {
  const home = useHome();
  const [planVersion, setPlanVersion] = useState(0);
  const planChanged = useCallback(() => setPlanVersion((v) => v + 1), []);
  const { pathname } = useLocation();
  const invite = useInvite();
  const session = useSession();
  const { reload } = home;

  const finishJoin = useCallback(
    (outcome: JoinOutcome) => {
      session.finishJoin(outcome);
      // The Shell fetched the Home behind the dialog; after a join it is out of date.
      void reload();
      planChanged();
    },
    [session, reload, planChanged],
  );

  const content = useRef<HTMLDivElement>(null);
  const lastPath = useRef(pathname);
  // Declarative routing does not move focus, so a screen reader would not hear the new tab. Land on its heading.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const heading = content.current?.querySelector<HTMLElement>("h2");
    const target = heading ?? content.current;
    if (!target) return;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: false });
  }, [pathname]);

  // Dialogs wait on the other tabs; a pending Invite sends every path to Today anyway (see resolveRoute).
  const dialog = pathname === TODAY_PATH ? dialogToShow({ inviteToken: invite.token, after: session.after, choosing: session.choosing }) : null;

  return (
    <ShellContext.Provider value={{ home, planVersion, planChanged }}>
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
