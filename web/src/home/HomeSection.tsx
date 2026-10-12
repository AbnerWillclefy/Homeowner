import { useState } from "react";
import type { Home } from "../api/home";
import { ChoresSection } from "../chores/ChoresSection";
import { TodaySection } from "../dayplan/TodaySection";
import { useI18n } from "../i18n";
import { InviteShare } from "../invite/InviteShare";
import { CreateHome } from "./CreateHome";
import { LOAD_FAILURE_KEY } from "./failureMessages";
import { HomeSettingsForm } from "./HomeSettingsForm";
import { LeaveHome } from "./LeaveHome";
import { useHome } from "./useHome";

/**
 * The Home section of the home screen, shown only while signed in: the create form for a User with no Home,
 * otherwise the Home's settings followed by its Chores.
 */
export function HomeSection() {
  const { state, reload, setHome, clearHome } = useHome();
  const { t } = useI18n();
  // Set when a create found an existing Home; cleared by the next save so it never outlives its moment.
  // `chores-dropped` is a create whose reviewed Chores were not added, because the Home already existed.
  const [recovered, setRecovered] = useState<"no" | "plain" | "chores-dropped">("no");

  if (state.kind === "loading") return <p role="status">{t("home.loading")}</p>;

  if (state.kind === "failed") {
    return (
      <section aria-labelledby="home-load-heading">
        <h2 id="home-load-heading">{t("home.settings.heading")}</h2>
        <p role="alert" className="text-danger">
          {t(LOAD_FAILURE_KEY[state.reason])}
        </p>
        {state.reason !== "not-signed-in" && (
          <button type="button" className="btn" onClick={reload}>
            {t("home.retry")}
          </button>
        )}
      </section>
    );
  }

  if (state.kind === "none") {
    return (
      <CreateHome
        onSaved={setHome}
        onRecovered={(home: Home, choresDropped: boolean) => {
          setRecovered(choresDropped ? "chores-dropped" : "plain");
          setHome(home);
        }}
      />
    );
  }

  return (
    <>
      {recovered !== "no" && (
        <p role="status">{t(recovered === "chores-dropped" ? "home.create.recovered.chores" : "home.create.recovered")}</p>
      )}
      <HomeSettingsForm
        key={state.home.id}
        home={state.home}
        onSaved={(home: Home) => {
          setRecovered("no");
          setHome(home);
        }}
      />
      <InviteShare />
      <TodaySection />
      <ChoresSection />
      <LeaveHome
        onLeft={() => {
          setRecovered("no");
          clearHome();
        }}
      />
    </>
  );
}
