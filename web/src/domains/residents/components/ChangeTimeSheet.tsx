import { Sheet } from "@homeowner/bedrock";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useUndoable } from "../../../shared/undo/useUndoable";
import { useMoveCompletion } from "../hooks/useMoveCompletion";
import { completionBounds, parsePicked, toLocalInput } from "../logic/completionTimeBounds";
import { moveFailureKey, pickedProblemKey } from "../logic/moveFailures";

/** The Completion to move. `completedAt` is an instant, RFC 3339. */
export interface MovableCompletion {
  id: string;
  choreName: string;
  completedAt: string;
}

/**
 * Asks when a Completion was really done, in a Sheet opened by `trigger` (focus returns to it). The picker works
 * in the device's zone and is bounded to now and the start of `today - 29` in the Home's zone; the server decides
 * which day that counts for and the screens show its answer. Saving closes the Sheet and sends at once; a toast
 * says it and Desfazer writes the old time back (`undoableChange`). A server refusal, including Desfazer landing
 * outside the 30 days after midnight, is the usual error toast. iOS Safari ignores `min` and `max`, so Save checks
 * the bounds again before calling the API, and says a problem in the Sheet, which stays open.
 */
export function ChangeTimeSheet({
  completion,
  today,
  timeZone,
  trigger,
  onMoved,
}: {
  completion: MovableCompletion;
  /** The Home's date, YYYY-MM-DD. */
  today: string;
  /** The Home's zone. */
  timeZone: string;
  /** The "Change time" button. */
  trigger: ReactNode;
  /** Called when the server accepted a move or its undo, so the card can show it is busy until the plan is read again. */
  onMoved?(): void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const formId = useId();
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={t("completion.changeTime")}
      subtitle={completion.choreName}
      closeLabel={t("dayplan.task.sheet.close")}
      footer={<Button type="submit" form={formId}>{t("completion.changeTime.save")}</Button>}
    >
      {/* Mounted only while open, so the bounds and the value start fresh each time. */}
      <ChangeTimeForm id={formId} completion={completion} today={today} timeZone={timeZone} onMoved={onMoved} onClose={() => setOpen(false)} />
    </Sheet>
  );
}

function ChangeTimeForm({
  id,
  completion,
  today,
  timeZone,
  onMoved,
  onClose,
}: {
  id: string;
  completion: MovableCompletion;
  today: string;
  timeZone: string;
  onMoved?(): void;
  onClose(): void;
}) {
  const { t } = useI18n();
  const { move } = useMoveCompletion();
  const { undoableChange } = useUndoable();
  const inputId = useId();
  const messageId = useId();
  const [bounds] = useState(() => completionBounds(new Date(), today, timeZone));
  const [value, setValue] = useState(() => toLocalInput(completion.completedAt));
  const [problem, setProblem] = useState<MessageKey | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const picked = parsePicked(value, bounds);
    if ("problem" in picked) return setProblem(pickedProblemKey(picked.problem));
    const before = completion.completedAt;
    let refusal: MessageKey = "completion.changeTime.error";
    // Both writes say why they failed in the toast's words, which are known only once the server answered.
    const write = async (completedAt: string) => {
      const result = await move({ id: completion.id, completedAt });
      if (result.kind === "ok") onMoved?.();
      else refusal = moveFailureKey(result);
      return result;
    };
    onClose();
    void undoableChange({
      key: `move-completion:${completion.id}`,
      titleKey: "completion.changeTime.undo.title",
      titleParams: { chore: completion.choreName },
      get failedKey() {
        return refusal;
      },
      // The card changes when the server answers, so there is nothing to show or restore here.
      apply: () => {},
      revert: () => {},
      send: () => write(picked.date.toISOString()),
      sendRevert: () => write(before),
    });
  }

  return (
    <form id={id} onSubmit={onSubmit} noValidate className="flex flex-col gap-2 pb-4">
      <label htmlFor={inputId} className="font-semibold">
        {t("completion.changeTime.label")}
      </label>
      <input
        id={inputId}
        type="datetime-local"
        value={value}
        min={toLocalInput(bounds.min)}
        max={toLocalInput(bounds.max)}
        onChange={(event) => {
          setValue(event.target.value);
          setProblem(null);
        }}
        aria-describedby={problem === null ? undefined : messageId}
      />
      <p className="my-0 text-sm text-muted">{t("completion.changeTime.hint")}</p>
      {/* Always in the page, so a screen reader speaks what is put into it. Calm: plain text colour and no "!". */}
      <div role="alert">
        {problem !== null && (
          <p id={messageId} className="my-0 font-semibold">
            {t(problem)}
          </p>
        )}
      </div>
    </form>
  );
}
