import { AppDialog } from "../shared/ui/AppDialog";
import { ButtonRow } from "../shared/ui/ButtonRow";
import { useI18n, type MessageKey } from "../shared/i18n";
import { Button } from "../shared/ui/Button";
import { rightAwayOutcome, type RightAwayOutcome } from "./rightAwayOutcome";
import { useRightAway } from "./useRightAway";

const FAILURE_KEY = {
  offline: "startChoice.failed.offline",
  error: "startChoice.failed.error",
  "not-signed-in": "dayplan.notSignedIn",
} as const satisfies Record<string, MessageKey>;

const OUTCOME_KEY: Record<RightAwayOutcome, MessageKey> = {
  tasks: "startChoice.done.tasks",
  "no-energy": "startChoice.done.noEnergy",
  nothing: "startChoice.done.nothing",
  rejected: "dayplan.rejected",
};

interface Props {
  /** The Resident chose to wait, or has read the result: the choice is over. Nothing is stored. */
  onDecided(): void;
  /** Their Tasks were planned, so the Today section must show the new plan. */
  onPlanned(): void;
}

/**
 * A dialog over Today, shown once at the end of either onboarding: get Tasks now, or wait for the next daily
 * Allocation. "Start tomorrow" only dismisses (so do Escape and a tap outside, except while planning);
 * "right away" plans this Resident alone and the result appears in Today.
 */
export function StartChoice({ onDecided, onPlanned }: Props) {
  const { t } = useI18n();
  const { state, start } = useRightAway(onPlanned);
  const planning = state.kind === "planning";

  return (
    <AppDialog title={t("startChoice.heading")} dismissible={!planning} onDismiss={onDecided}>
      {state.kind === "done" ? (
        <>
          <p role="status">{t(OUTCOME_KEY[rightAwayOutcome(state.plan)])}</p>
          <Button onClick={onDecided}>
            {t("startChoice.done.close")}
          </Button>
        </>
      ) : (
        <>
          {planning && <p role="status">{t("startChoice.planning")}</p>}
          {state.kind === "failed" && (
            <p role="alert" className="text-danger">
              {t(FAILURE_KEY[state.reason])}
            </p>
          )}

          {/* A real disabled button while planning, so a second tap cannot send a second request. */}
          <ButtonRow className="mt-2">
            <Button disabled={planning} aria-busy={planning} onClick={() => void start()}>
              {state.kind === "failed" && state.reason !== "not-signed-in" ? t("startChoice.retry") : t("startChoice.now.button")}
            </Button>
            <Button variant="secondary" disabled={planning} onClick={onDecided}>
              {t("startChoice.tomorrow.button")}
            </Button>
          </ButtonRow>
        </>
      )}
    </AppDialog>
  );
}
