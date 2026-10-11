import { useState } from "react";
import { useI18n } from "../i18n";
import { CreateHome } from "./CreateHome";
import { HomeSettingsForm } from "./HomeSettingsForm";
import { useHome } from "./useHome";

/**
 * The Home section of the home screen, shown only while signed in: the create form for a User with no Home,
 * otherwise the Home's settings. The Chores list (#96) goes inside the ready state.
 */
export function HomeSection() {
  const { state, reload, setHome } = useHome();
  const { t } = useI18n();
  const [recovered, setRecovered] = useState(false);

  if (state.kind === "loading") return <p role="status">{t("home.loading")}</p>;

  if (state.kind === "failed") {
    return (
      <section aria-labelledby="home-load-heading">
        <h2 id="home-load-heading">{t("home.settings.heading")}</h2>
        <p role="alert" className="text-danger">
          {t(state.reason === "offline" ? "home.load.offline" : state.reason === "error" ? "home.load.error" : "home.notSignedIn")}
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
        onSaved={(home, wasRecovered) => {
          setRecovered(wasRecovered);
          setHome(home);
        }}
      />
    );
  }

  return (
    <>
      {recovered && <p role="status">{t("home.create.recovered")}</p>}
      <HomeSettingsForm key={state.home.id} home={state.home} onSaved={setHome} />
    </>
  );
}
