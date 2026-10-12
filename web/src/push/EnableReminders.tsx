import { useI18n } from "../shared/i18n";
import { Button } from "../shared/ui/Button";
import { problemText } from "./problemText";
import type { RemindersState } from "./usePush";

/**
 * The Enable reminders button and, when turning them on failed, why. Permission is asked only when this
 * button is tapped, never on mount (ADR 0005). Shown while reminders are not on.
 */
export function EnableReminders({
  reminders,
  onEnable,
}: {
  reminders: RemindersState;
  onEnable(): void;
}) {
  const { t } = useI18n();
  const problem =
    reminders.kind === "problem" ? problemText(reminders.problem) : null;
  return (
    <div className="flex flex-col">
      <Button
        onClick={onEnable}
        disabled={reminders.kind === "working"}
        aria-busy={reminders.kind === "working"}
      >
        {reminders.kind === "working"
          ? t("reminders.enabling")
          : t("reminders.enable")}
      </Button>
      {problem && <p role="alert">{t(problem.key, problem.params)}</p>}
    </div>
  );
}
