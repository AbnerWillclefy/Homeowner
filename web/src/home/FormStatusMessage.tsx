import { useI18n } from "../i18n";
import { SAVE_FAILURE_KEY } from "./failureMessages";
import type { FormStatus } from "./useSettingsForm";

/** The summary under a Home form: a problem is an alert in the danger colour, a success is a status. */
export function FormStatusMessage({ status }: { status: FormStatus }) {
  const { t } = useI18n();
  if (status.kind === "invalid") {
    return (
      <p role="alert" className="text-danger">
        {t("home.invalid.summary")}
      </p>
    );
  }
  if (status.kind === "failed") {
    return (
      <p role="alert" className="text-danger">
        {t(SAVE_FAILURE_KEY[status.reason])}
      </p>
    );
  }
  return null;
}
