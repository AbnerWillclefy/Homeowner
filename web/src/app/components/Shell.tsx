import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation } from "react-router";
import { homeJoined } from "../../domains/home/api/queries";
import { useHome } from "../../domains/home/hooks/useHome";
import { useMe } from "../../domains/profile/hooks/useMe";
import { useResidents } from "../../domains/residents/hooks/useResidents";
import { useI18n } from "../../shared/i18n";
import { useInvite } from "../../domains/invite/components/PendingInviteProvider";
import type { JoinOutcome } from "../../domains/invite/hooks/useJoinInvite";
import { StartChoice } from "../../domains/startchoice/components/StartChoice";
import { lazyWithReload } from "../lazyWithReload";
import { BottomNav } from "./BottomNav";
import { LazyDialog } from "./LazyPage";
import { dialogToShow } from "../logic/dialogToShow";
import { PageFrame } from "./PageFrame";
import { useSession } from "./SessionProvider";
import { ShellContext } from "./ShellContext";
import { TODAY_PATH } from "../logic/routes";
import { useFocusOnNavigate } from "../hooks/useFocusOnNavigate";

// The dialogs load on demand: most launches never show them.
const JoinInvite = lazyWithReload(() => import("../../domains/invite/components/JoinInvite").then((module) => ({ default: module.JoinInvite })));
const RatingStep = lazyWithReload(() => import("../../domains/invite/components/RatingStep").then((module) => ({ default: module.RatingStep })));

/**
 * The app once onboarding is done: the current tab, the bottom nav, and the dialogs over Today. The Home loads
 * here, not above the welcome routes, so it is fresh when the walk ends and never a stale "no Home".
 */
export function Shell() {
  const { t } = useI18n();
  const home = useHome();
  const residents = useResidents(home.state.kind === "ready");
  const me = useMe();
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
    <ShellContext.Provider value={{ home, residents, me }}>
      <div className="flex min-h-dvh flex-col">
        <PageFrame className="flex-1">
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
    </ShellContext.Provider>
  );
}
