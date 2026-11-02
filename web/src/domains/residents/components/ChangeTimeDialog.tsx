import { useId, useState, type FormEvent, type RefObject } from "react";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import { useMoveCompletion } from "../hooks/useMoveCompletion";
import { completionBounds, fromLocalInput, pickedProblem, toLocalInput } from "../logic/completionTimeBounds";
import { moveFailureKey, pickedProblemKey } from "../logic/moveFailures";

/** The Completion to move. `completedAt` is an instant, RFC 3339. */
export interface MovableCompletion {
  id: string;
  choreName: string;
  completedAt: string;
}

/**
 * Asks when a Completion was really done. The picker works in the device's zone and is bounded to now and the
 * start of `today - 29` in the Home's zone; the server decides which day that counts for and the screens show its
 * answer. Mounted only while open, so it starts fresh each time. An error leaves it open with a calm message; success
 * closes it. iOS Safari ignores `min` and `max`, so Save checks the bounds again before calling the API.
 */
export function ChangeTimeDialog({
  completion,
  today,
  timeZone,
  returnFocusRef,
  onMoved,
  onClose,
}: {
  completion: MovableCompletion;
  /** The Home's date, YYYY-MM-DD. */
  today: string;
  /** The Home's zone. */
  timeZone: string;
  /** The "Change time" button, where focus returns. */
  returnFocusRef: RefObject<HTMLElement | null>;
  /** Called once the server accepted the move, before the dialog closes. */
  onMoved?(): void;
  onClose(): void;
}) {
  const { t } = useI18n();
  const { move } = useMoveCompletion();
  const inputId = useId();
  const messageId = useId();
  const [bounds] = useState(() => completionBounds(new Date(), today, timeZone));
  const [value, setValue] = useState(() => toLocalInput(completion.completedAt));
  const [failure, setFailure] = useState<MessageKey | null>(null);

  // The guard covers a second Enter or tap in the same tick, which the async `pending` state does not.
  const { run: save, pending } = useSubmitOnce(async () => {
    const problem = pickedProblem(value, bounds);
    if (problem !== null) return setFailure(pickedProblemKey(problem));
    setFailure(null);
    const result = await move({ id: completion.id, completedAt: fromLocalInput(value)!.toISOString() });
    if (result.kind !== "ok") return setFailure(moveFailureKey(result));
    onMoved?.();
    onClose();
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void save();
  }

  const formId = `${inputId}-form`;
  return (
    <AppDialog
      title={t("completion.changeTime")}
      description={<span className="[overflow-wrap:anywhere]">{completion.choreName}</span>}
      onDismiss={onClose}
      dismissible={!pending}
      returnFocusRef={returnFocusRef}
      footer={
        <ButtonRow
          start={
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              {t("completion.changeTime.cancel")}
            </Button>
          }
          end={
            <Button type="submit" form={formId} pending={pending}>
              {t("completion.changeTime.save")}
            </Button>
          }
        />
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-2">
        <label htmlFor={inputId} className="font-semibold">
          {t("completion.changeTime.label")}
        </label>
        <input
          id={inputId}
          type="datetime-local"
          value={value}
          min={toLocalInput(bounds.min)}
          max={toLocalInput(bounds.max)}
          disabled={pending}
          onChange={(event) => {
            setValue(event.target.value);
            setFailure(null);
          }}
          aria-describedby={failure === null ? undefined : messageId}
        />
        <p className="my-0 text-sm text-muted">{t("completion.changeTime.hint")}</p>
        {/* Always in the page, so a screen reader speaks what is put into it. Calm: plain text colour and no "!". */}
        <div role="alert">
          {failure !== null && (
            <p id={messageId} className="my-0 font-semibold">
              {t(failure)}
            </p>
          )}
        </div>
      </form>
    </AppDialog>
  );
}
