import type { CheckIn } from "../api/checkIn";
import { CardRow } from "../components/ui/CardRow";
import { Button } from "../shared/ui/Button";
import { useI18n } from "../i18n";
import { demandLabel, labelText } from "../profile/labels";
import { CheckInDialog } from "./CheckInDialog";
import { LOAD_FAILURE_KEY } from "./failureMessages";
import { LEVEL_KEYS } from "./labels";
import { checkInView } from "./state";
import type { useCheckIn } from "./useCheckIn";

type Controller = ReturnType<typeof useCheckIn>;

interface Props {
  checkIn: Controller;
  /** Whether the Check-in dialog is showing. `HomeDay` owns it, because the Energy chip opens it too. */
  open: boolean;
  onOpen(): void;
  onClose(): void;
}

/**
 * Today's Check-in as one compact row: what is known on the left (the prompt, or the summary), one action on
 * the right ("Check in" or "Change"). The form is in a dialog, so Today stays short. When the Check-in is
 * missing the row asks every time the app opens; nothing about it being skipped is kept.
 */
export function CheckInSection({ checkIn, open, onOpen, onClose }: Props) {
  const { t } = useI18n();
  const { state } = checkIn;
  const view = checkInView(state);

  return (
    <section aria-label={t("checkin.heading")}>
      {view === "loading" && (
        <CardRow>
          <p role="status" className="my-0">
            {t("checkin.loading")}
          </p>
        </CardRow>
      )}

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
        <>
          <CardRow
            actions={
              <Button variant={view === "prompt" ? "primary" : "secondary"} onClick={onOpen}>
                {t(view === "prompt" ? "checkin.open" : "checkin.change")}
              </Button>
            }
          >
            {view === "prompt" ? (
              <p className="my-0 font-semibold">{t("checkin.prompt")}</p>
            ) : (
              <Summary checkIn={state.checkIn} />
            )}
          </CardRow>
          {/* Mounted only while open, so the form starts again from the saved Check-in each time. */}
          {open && (
            <CheckInDialog checkIn={state.checkIn} demands={checkIn.demands} save={checkIn.save} onClose={onClose} />
          )}
        </>
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
      <p className="my-0 font-semibold">{t("checkin.summary", { level: t(LEVEL_KEYS[level].label) })}</p>
      {restrictions.length > 0 && (
        <p className="my-0">
          {t("checkin.summary.restrictions", {
            demands: restrictions.map((id) => labelText(t, demandLabel(id))).join(", "),
          })}
        </p>
      )}
    </>
  );
}
