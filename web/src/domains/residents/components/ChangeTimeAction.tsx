import { useRef, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { ChangeTimeDialog, type MovableCompletion } from "./ChangeTimeDialog";

/**
 * The "Change time" button for a Completion, on its own row at the bottom of a card (thumb reach), and the dialog it
 * opens. The visible label is short; the accessible name adds the Chore so a list of them is told apart. Only the
 * caller's own Completions get one, so the caller decides whether to render it.
 */
export function ChangeTimeAction({
  completion,
  today,
  timeZone,
  onMoved,
}: {
  completion: MovableCompletion;
  today: string;
  timeZone: string;
  onMoved?(): void;
}) {
  const { t } = useI18n();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        ref={buttonRef}
        variant="secondary"
        className="self-start"
        aria-label={t("completion.changeTime.for", { chore: completion.choreName })}
        onClick={() => setOpen(true)}
      >
        {t("completion.changeTime")}
      </Button>
      {open && (
        <ChangeTimeDialog completion={completion} today={today} timeZone={timeZone} returnFocusRef={buttonRef} onMoved={onMoved} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
