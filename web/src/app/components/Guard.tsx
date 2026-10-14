import { Navigate, Outlet, useLocation } from "react-router";
import { useI18n, type MessageKey } from "../../shared/i18n";
import { useInvite } from "../../domains/invite/components/PendingInviteProvider";
import type { OnboardingProblem } from "../../domains/onboarding/hooks/useOnboarding";
import { Button } from "../../shared/ui/Button";
import { useAppAuth } from "./AuthProvider";
import { PageFrame } from "./PageFrame";
import { onboardingInput, resolveRoute } from "../logic/resolveRoute";
import { safeWantedPath, type AuthRouteState } from "../logic/routes";
import { SessionProvider, useOptionalSession, useSession } from "./SessionProvider";

const PROBLEM_KEY: Record<OnboardingProblem, MessageKey> = {
  offline: "onboarding.load.offline",
  error: "onboarding.load.error",
  "not-signed-in": "onboarding.load.notSignedIn",
};

/**
 * Decides where the person may be (see resolveRoute) and renders the route, a wait status, or "Try again".
 * The signed-in session is mounted here, once, so it is shared by every route below.
 */
export function Guard() {
  const auth = useAppAuth();
  if (auth.state.kind === "signed-in") {
    return (
      <SessionProvider>
        <Decide />
      </SessionProvider>
    );
  }
  return <Decide />;
}

function Decide() {
  const { t } = useI18n();
  const auth = useAppAuth();
  const invite = useInvite();
  const location = useLocation();
  const session = useOptionalSession();

  const decision = resolveRoute({
    auth: auth.state.kind,
    onboarding: onboardingInput(session?.onboarding.state ?? null),
    pathname: location.pathname,
    wanted: (location.state as AuthRouteState | null)?.from ?? null,
    hasPendingInvite: invite.token !== null,
    steps: session?.steps ?? [],
  });

  switch (decision.kind) {
    case "render":
      return <Outlet />;

    case "redirect": {
      // Remember where a signed-out person was headed, unless they chose to sign out.
      const from = auth.state.kind === "signed-out" && !auth.signedOutOnPurpose ? safeWantedPath(location.pathname) : null;
      const state: AuthRouteState | undefined = from === null ? undefined : { from };
      return <Navigate to={decision.to} replace state={state} />;
    }

    case "retry":
      return <Retry />;

    case "wait":
      return (
        <PageFrame>
          <p role="status">{t(auth.state.kind === "loading" ? "auth.checking" : "onboarding.loading")}</p>
        </PageFrame>
      );
  }
}

function Retry() {
  const { t } = useI18n();
  const { onboarding } = useSession();
  if (onboarding.state.kind !== "problem") return null;
  const { problem } = onboarding.state;
  return (
    <PageFrame>
      <section>
        <p role="alert">{t(PROBLEM_KEY[problem])}</p>
        {problem !== "not-signed-in" && (
          <Button variant="secondary" onClick={onboarding.retry}>
            {t("onboarding.retry")}
          </Button>
        )}
      </section>
    </PageFrame>
  );
}
