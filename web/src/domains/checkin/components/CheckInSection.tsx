import type { ReactNode } from "react";
import type { CheckIn } from "../api/api";
import { Card } from "../../../shared/ui/Card";
import { CardRow } from "../../../shared/ui/CardRow";
import { useI18n } from "../../../shared/i18n";
import { demandLabel, labelText } from "../../profile/logic/labels";
import { Button } from "../../../shared/ui/Button";
import { useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { useShell } from "../../../app/components/ShellContext";
import { CheckInSkeleton } from "./CheckInSkeleton";
import { LOAD_FAILURE_KEY } from "../logic/failureMessages";
import { LEVEL_KEYS } from "../logic/labels";
import { checkInView } from "../logic/state";
import type { useCheckIn } from "../hooks/useCheckIn";

type Controller = ReturnType<typeof useCheckIn>;

interface Props {
  checkIn: Controller;
  /** Today's Energy, shown above the Check-in once there is one. Null leaves the Check-in to speak alone. */
  energy?: ReactNode;
}

/**
 * Today's Check-in as one card: what is known on the left (the prompt, or today's Energy), one action on the
 * right ("Check in" or "Change"), and the Check-in itself under a rule once there is Energy to show above it. The form is in the Shell's one Check-in dialog (`useShell().openCheckIn`), the same the top bar's pill opens. When the Check-in is
 * missing the row asks every time the app opens; nothing about it being skipped is kept.
 */
export function CheckInSection({ checkIn, energy }: Props) {
  const { t } = useI18n();
  const { openCheckIn } = useShell();
  const { state } = checkIn;
  const view = checkInView(state);
  // The page's one status announces the wait; the skeleton shows after 300ms. Only the first load and a Retry load.
  const showSkeleton = useReportFirstLoad(view === "loading");

  return (
    <section aria-label={t("checkin.heading")}>
      {showSkeleton && <CheckInSkeleton />}

      {state.kind === "failed" && (
        <CardRow
          actions={
            state.reason !== "not-signed-in" && (
              <Button variant="secondary" onClick={checkIn.reload}>
                {t("checkin.retry")}
              </Button>
            )
          }
        >
          <p role="alert" className="my-0 text-danger">
            {t(LOAD_FAILURE_KEY[state.reason])}
          </p>
        </CardRow>
      )}

      {state.kind === "ready" && (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]">
              {view === "prompt" ? (
                <p className="my-0 text-lg font-bold">{t("checkin.prompt")}</p>
              ) : (
                (energy ?? <Summary checkIn={state.checkIn} />)
              )}
            </div>
            <Button variant={view === "prompt" ? "primary" : "secondary"} onClick={(event) => openCheckIn(event.currentTarget)}>
              {t(view === "prompt" ? "checkin.open" : "checkin.change")}
            </Button>
          </div>
          {view === "summary" && energy && (
            <div className="border-t border-border/40 pt-3 text-sm text-muted">
              <Summary checkIn={state.checkIn} />
            </div>
          )}
        </Card>
      )}
    </section>
  );
}

function Summary({ checkIn }: { checkIn: CheckIn }) {
  const { t } = useI18n();
  const { level, restrictions } = checkIn;
  if (level === null) return null; // Narrows the type: a Check-in that is checked in always has a level.
  return (
    <>
      <p className="my-0">
        {t("checkin.summary", { level: t(LEVEL_KEYS[level].label) })}
      </p>
      {restrictions.length > 0 && (
        <p className="my-0">
          {t("checkin.summary.restrictions", {
            demands: restrictions
              .map((id) => labelText(t, demandLabel(id)))
              .join(", "),
          })}
        </p>
      )}
    </>
  );
}
