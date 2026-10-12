import { useCallback, useState, type ReactNode } from "react";
import type { RecoveredNotice } from "../home/HomeSection";
import { useI18n, type MessageKey } from "../i18n";
import { Onboarding } from "./Onboarding";
import { useOnboarding, type OnboardingProblem } from "./useOnboarding";

const PROBLEM_KEY: Record<OnboardingProblem, MessageKey> = {
  offline: "onboarding.load.offline",
  error: "onboarding.load.error",
  "not-signed-in": "onboarding.load.notSignedIn",
};

/**
 * Shows the onboarding walk in place of the dashboard until the User's progress reaches `done`, then renders
 * the dashboard exactly as before. While progress is unknown (loading or failed) it shows that, never a
 * guess. Only mounted while signed in and with no pending Invite (see App).
 */
export function OnboardingGate({
  onFinished,
  children,
}: {
  /** The Home step ended, by creating the Home or by finding one already made: the start choice follows. */
  onFinished(): void;
  children(recovered: RecoveredNotice | "no"): ReactNode;
}) {
  const { t } = useI18n();
  const { state, retry, setPosition } = useOnboarding();
  const [recovered, setRecovered] = useState<RecoveredNotice | "no">("no");
  const onHomeFinished = useCallback(
    (notice: RecoveredNotice | null) => {
      setRecovered(notice ?? "no");
      onFinished();
    },
    [onFinished],
  );

  if (state.kind === "loading") return <p role="status">{t("onboarding.loading")}</p>;

  if (state.kind === "problem") {
    return (
      <section>
        <p role="alert">{t(PROBLEM_KEY[state.problem])}</p>
        {state.problem !== "not-signed-in" && (
          <button type="button" className="btn" onClick={retry}>
            {t("onboarding.retry")}
          </button>
        )}
      </section>
    );
  }

  if (state.position === "done") return <>{children(recovered)}</>;

  return <Onboarding position={state.position} onPosition={setPosition} onHomeFinished={onHomeFinished} />;
}
