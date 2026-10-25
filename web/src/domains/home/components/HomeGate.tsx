import type { ReactNode } from "react";
import { useShell } from "../../../app/components/ShellContext";
import { useSession } from "../../../app/components/SessionProvider";
import type { Home } from "../api/api";
import { useI18n } from "../../../shared/i18n";
import { useInvite } from "../../invite/components/PendingInviteProvider";
import { Button } from "../../../shared/ui/Button";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { CreateHome } from "./CreateHome";
import { LOAD_FAILURE_KEY } from "../logic/failureMessages";
import { homeView } from "../logic/homeView";

/**
 * What every Home-dependent tab (Today, Chores, Home) shows until the person has a Home: the tab's `skeleton`
 * (after 300ms; the page's status announces the wait), the failure
 * with Retry, or the create form. With a Home it renders the tab's content. While an Invite is pending a missing
 * Home reads as loading, because joining is how this person gets one.
 */
export function HomeGate({ skeleton, children }: { skeleton: ReactNode; children(home: Home): ReactNode }) {
  const { t } = useI18n();
  const { home } = useShell();
  const { setRecovered } = useSession();
  const invite = useInvite();
  const { state, refreshing, reload, setCreatedHome } = home;
  const view = homeView(state, invite.token !== null);
  // The page's one status speaks for the Home loading; this shows the page's skeleton once the wait passes 300ms.
  const showSkeleton = useReportFirstLoad(view === "loading");
  // A refresh over a Home already on screen shows the page's quiet indicator, never the skeleton.
  useReportFetching(refreshing);

  switch (view) {
    case "loading":
      return showSkeleton ? <>{skeleton}</> : null;

    case "failed":
      if (state.kind !== "failed") return null;
      return (
        <section aria-labelledby="home-load-heading">
          <h2 id="home-load-heading">{t("home.settings.heading")}</h2>
          <p role="alert" className="text-danger">
            {t(LOAD_FAILURE_KEY[state.reason])}
          </p>
          {state.reason !== "not-signed-in" && (
            <Button variant="secondary" onClick={reload}>
              {t("home.retry")}
            </Button>
          )}
        </section>
      );

    case "create":
      return (
        <CreateHome
          onSaved={(saved: Home) => void setCreatedHome(saved)}
          onRecovered={(found: Home, choresDropped: boolean) => {
            setRecovered(choresDropped ? "chores-dropped" : "plain");
            void setCreatedHome(found);
          }}
        />
      );

    case "ready":
      return state.kind === "ready" ? <>{children(state.home)}</> : null;
  }
}
