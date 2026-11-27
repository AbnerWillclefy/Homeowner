import { CircleCheck, Sparkles } from "lucide-react";
import { Button, Sheet } from "@homeowner/bedrock";
import { useShell } from "../../../app/components/ShellContext";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { DEFAULT_ALLOCATION_TIME, formatAllocationTime } from "../../home/logic/allocationTimes";
import { rightAwayOutcome, type RightAwayOutcome } from "../logic/rightAwayOutcome";
import { useRightAway } from "../hooks/useRightAway";

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
}

const TILE = "grid size-14 place-items-center rounded-lg bg-brand-soft text-brand";

/**
 * A Sheet over Today, shown once at the end of either onboarding: it explains when the daily plan comes out, then
 * offers to get Tasks now (first, the primary button) or wait for the next daily Allocation. "Start tomorrow" is the
 * way out, so there is no ✕; Escape and a drag down close it as "tomorrow" too, except while planning. "Right away"
 * plans this Resident alone and the result appears in Today.
 */
export function StartChoice({ onDecided }: Props) {
  const { t, locale } = useI18n();
  const { home } = useShell();
  const { state, start } = useRightAway();
  const planning = state.kind === "planning";
  const time = formatAllocationTime(home.state.kind === "ready" ? home.state.home.allocationTime : DEFAULT_ALLOCATION_TIME, locale);
  const done = state.kind === "done";

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onDecided()}
      title={t("startChoice.heading")}
      subtitle={state.kind === "idle" || state.kind === "failed" ? t("startChoice.explain", { time }) : undefined}
      closeLabel={t("startChoice.tomorrow.button")}
      closeButton={false}
      dismissible={!planning}
      footer={
        done ? (
          <Button size="lg" onClick={onDecided}>
            {t("startChoice.done.close")}
          </Button>
        ) : (
          <>
            {/* A real disabled button while planning, so a second tap cannot send a second request. */}
            <Button size="lg" loading={planning} onClick={() => void start()}>
              {state.kind === "failed" && state.reason !== "not-signed-in" ? t("startChoice.retry") : t("startChoice.now.button")}
            </Button>
            <Button size="lg" variant="secondary" disabled={planning} onClick={onDecided}>
              {t("startChoice.tomorrow.button")}
            </Button>
          </>
        )
      }
    >
      <div className="pb-4">
        {done && (
          <div role="status" className="flex flex-col items-center gap-4 py-4 text-center">
            <span aria-hidden className={TILE}>
              <CircleCheck className="size-7" />
            </span>
            <p className="body-strong my-0">{t(OUTCOME_KEY[rightAwayOutcome(state.plan)])}</p>
          </div>
        )}
        {planning && (
          <div role="status" aria-busy="true" className="flex flex-col items-center gap-4 py-4 text-center">
            <span aria-hidden className={TILE}>
              <Sparkles className="size-7" />
            </span>
            <p className="body-strong my-0">{t("startChoice.planning")}</p>
          </div>
        )}
        {state.kind === "failed" && (
          <p role="alert" className="body my-0 text-danger">
            {t(FAILURE_KEY[state.reason])}
          </p>
        )}
      </div>
    </Sheet>
  );
}
