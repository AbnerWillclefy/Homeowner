import { SignedIn } from "./auth/SignedIn";
import { SignedOutFlow } from "./auth/SignedOutFlow";
import { useAuth } from "./auth/useAuth";
import { Reminders } from "./push/Reminders";
import { useI18n, type MessageKey } from "./i18n";
import { Settings } from "./settings/Settings";
import { useHealth, type HealthState } from "./useHealth";

const STATUS_KEY: Record<HealthState["kind"], MessageKey> = {
  loading: "health.loading",
  ok: "health.ok",
  unavailable: "health.unavailable",
  unreachable: "health.unreachable",
};

export default function App() {
  const { state, retry } = useHealth();
  const auth = useAuth();
  const { t } = useI18n();

  return (
    <main className="page">
      <h1>{t("app.name")}</h1>
      <p>{t("home.tagline")}</p>
      <p role="status" data-state={state.kind}>
        {t(STATUS_KEY[state.kind])}
      </p>
      {(state.kind === "unavailable" || state.kind === "unreachable") && (
        <button type="button" className="btn" onClick={retry}>
          {t("health.retry")}
        </button>
      )}

      {auth.state.kind === "loading" && <p role="status">{t("auth.checking")}</p>}
      {auth.state.kind === "signed-out" && (
        <SignedOutFlow register={auth.register} confirm={auth.confirm} resend={auth.resend} logIn={auth.logIn} />
      )}
      {auth.state.kind === "signed-in" && (
        <>
          <SignedIn email={auth.state.email} offline={auth.state.offline} onSignOut={auth.signOut} />
          {/* Reminders and the launch re-subscribe call protected routes, so they exist only while signed in. */}
          <Reminders />
        </>
      )}

      {/* Always shown, signed in or out: appearance needs no account. */}
      <Settings />
    </main>
  );
}
