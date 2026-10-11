import { useI18n, type MessageKey } from "../i18n";
import type { FormStatus } from "./useSettingsForm";

const FAILURE_KEY = {
  offline: "home.save.offline",
  error: "home.save.error",
  "not-signed-in": "home.notSignedIn",
} as const satisfies Record<string, MessageKey>;

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
        {t(FAILURE_KEY[status.reason])}
      </p>
    );
  }
  return null;
}
