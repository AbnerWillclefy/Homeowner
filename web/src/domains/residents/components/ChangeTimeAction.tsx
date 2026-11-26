import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { ChangeTimeSheet, type MovableCompletion } from "./ChangeTimeSheet";

/**
 * The "Change time" button for a Completion, on its own row at the bottom of a card (thumb reach), and the Sheet
 * it opens. The visible label is short; the accessible name adds the Chore so a list of them is told apart. Only
 * the caller's own Completions get one, so the caller decides whether to render it.
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
  return (
    <ChangeTimeSheet
      completion={completion}
      today={today}
      timeZone={timeZone}
      onMoved={onMoved}
      trigger={
        <Button variant="secondary" className="self-start" aria-label={t("completion.changeTime.for", { chore: completion.choreName })}>
          {t("completion.changeTime")}
        </Button>
      }
    />
  );
}
