import { useI18n } from "../i18n";
import { problemText } from "./problemText";
import type { RemindersState } from "./usePush";

/**
 * The Enable reminders button and, when turning them on failed, why. Permission is asked only when this
 * button is tapped, never on mount (ADR 0005). Shown while reminders are not on.
 */
export function EnableReminders({ reminders, onEnable }: { reminders: RemindersState; onEnable(): void }) {
  const { t } = useI18n();
  const problem = reminders.kind === "problem" ? problemText(reminders.problem) : null;
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={onEnable} disabled={reminders.kind === "working"}>
        {reminders.kind === "working" ? t("reminders.enabling") : t("reminders.enable")}
      </button>
      {problem && <p role="alert">{t(problem.key, problem.params)}</p>}
    </>
  );
}
