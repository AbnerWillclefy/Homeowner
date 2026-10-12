import { useCallback, useState } from "react";
import { JoinInvite } from "./invite/JoinInvite";
import { RatingStep } from "./invite/RatingStep";
import { SignedOutInvite } from "./invite/SignedOutInvite";
import { usePendingInvite } from "./invite/usePendingInvite";
import type { JoinOutcome } from "./invite/useJoinInvite";
import { SignedIn } from "./auth/SignedIn";
import { SignedOutFlow } from "./auth/SignedOutFlow";
import { useAuth } from "./auth/useAuth";
import { HomeSection } from "./home/HomeSection";
import { OnboardingGate } from "./onboarding/OnboardingGate";
import { Profile } from "./profile/Profile";
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
  const invite = usePendingInvite();
  // What to show above the Home right after an Invite is dealt with.
  const [after, setAfter] = useState<"rating" | "already-here" | null>(null);
  const { clear: clearInvite } = invite;
  const finishJoin = useCallback(
    (outcome: JoinOutcome) => {
      clearInvite();
      setAfter(outcome === "joined" ? "rating" : "already-here");
    },
    [clearInvite],
  );
  const closeRating = useCallback(() => setAfter(null), []);
  const notices = (
    <>
      {after === "already-here" && <p role="status">{t("invite.alreadyHere")}</p>}
      {after === "rating" && <RatingStep onClose={closeRating} />}
    </>
  );

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
      {auth.state.kind === "signed-out" &&
        (invite.token === null ? (
          <SignedOutFlow register={auth.register} confirm={auth.confirm} resend={auth.resend} logIn={auth.logIn} />
        ) : (
          <SignedOutInvite token={invite.token} onDismiss={invite.clear}>
            {(startOnSignUp) => (
              <SignedOutFlow
                register={auth.register}
                confirm={auth.confirm}
                resend={auth.resend}
                logIn={auth.logIn}
                startOnSignUp={startOnSignUp}
              />
            )}
          </SignedOutInvite>
        ))}
      {auth.state.kind === "signed-in" && (
        <>
          <SignedIn email={auth.state.email} offline={auth.state.offline} onSignOut={auth.signOut} />
          {/* A pending Invite wins over onboarding: joining is how this person gets a Home, so they never create one. */}
          {invite.token !== null ? (
            <>
              {/* Reminders and the launch re-subscribe call protected routes, so they exist only while signed in. */}
              <Reminders />
              {notices}
              <JoinInvite token={invite.token} onDismiss={invite.clear} onFinished={finishJoin} />
              <Profile />
            </>
          ) : (
            /* A new User walks through onboarding instead of the dashboard. Onboarding owns the push hook while
               it runs, so Reminders is mounted only once it is done and never twice. */
            <OnboardingGate>
              {(recovered) => (
                <>
                  <Reminders />
                  {notices}
                  {/* The Home calls protected routes too, so it also exists only while signed in. */}
                  <HomeSection recovered={recovered} />
                  <Profile />
                </>
              )}
            </OnboardingGate>
          )}
        </>
      )}

      {/* Always shown, signed in or out: appearance needs no account. */}
      <Settings />
    </main>
  );
}
