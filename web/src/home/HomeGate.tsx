import type { ReactNode } from "react";
import { useShell } from "../app/ShellContext";
import { useSession } from "../app/SessionProvider";
import type { Home } from "../api/home";
import { useI18n } from "../i18n";
import { useInvite } from "../invite/PendingInviteProvider";
import { Button } from "../shared/ui/Button";
import { CreateHome } from "./CreateHome";
import { LOAD_FAILURE_KEY } from "./failureMessages";
import { homeView } from "./homeView";

/**
 * What every Home-dependent tab (Today, Chores, Home) shows until the person has a Home: loading, the failure
 * with Retry, or the create form. With a Home it renders the tab's content. While an Invite is pending a missing
 * Home reads as loading, because joining is how this person gets one.
 */
export function HomeGate({ children }: { children(home: Home): ReactNode }) {
  const { t } = useI18n();
  const { home } = useShell();
  const { setRecovered } = useSession();
  const invite = useInvite();
  const { state, reload, setHome } = home;

  switch (homeView(state, invite.token !== null)) {
    case "loading":
      return <p role="status">{t("home.loading")}</p>;

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
          onSaved={setHome}
          onRecovered={(found: Home, choresDropped: boolean) => {
            setRecovered(choresDropped ? "chores-dropped" : "plain");
            setHome(found);
          }}
        />
      );

    case "ready":
      return state.kind === "ready" ? <>{children(state.home)}</> : null;
  }
}
