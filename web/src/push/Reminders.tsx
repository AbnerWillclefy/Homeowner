import { Card } from "../components/ui/Card";
import { useI18n } from "../i18n";
import { EnableReminders } from "./EnableReminders";
import { InstallSteps } from "./InstallSteps";
import { DELAYED_TEST_SECONDS, delayedTestLabel, testPendingText, testStatusText } from "./testText";
import { useSession } from "../app/SessionProvider";

/** The Reminders section of the Me tab. It uses the session's one push hook, so nothing re-subscribes twice. */
export function Reminders() {
  const { availability, reminders, enable, test, sendTest } = useSession().push;
  const { t } = useI18n();

  if (availability.kind === "needs-install") {
    return (
      <Card>
        <InstallSteps />
      </Card>
    );
  }

  if (availability.kind === "unsupported") {
    return (
      <Card as="section" aria-labelledby="reminders-heading">
        <h2 id="reminders-heading">{t("reminders.heading")}</h2>
        <p>{t("reminders.unsupported")}</p>
      </Card>
    );
  }

  const delayedLabel = delayedTestLabel(test.kind === "sending" && !!test.delaySeconds);
  const pending = test.kind === "sending" ? testPendingText(test.delaySeconds) : null;
  const testStatus = test.kind === "done" ? testStatusText(test.result, test.delaySeconds) : null;

  return (
    <Card as="section" aria-labelledby="reminders-heading">
      <h2 id="reminders-heading">{t("reminders.heading")}</h2>
      <p>{t("reminders.intro")}</p>

      {reminders.kind === "on" ? (
        <>
          <p role="status">{t("reminders.on")}</p>
          <button type="button" className="btn" onClick={() => sendTest()} disabled={test.kind === "sending"}>
            {test.kind === "sending" && !test.delaySeconds ? t("reminders.sendingTest") : t("reminders.sendTest")}
          </button>
          <button type="button" className="btn" onClick={() => sendTest(DELAYED_TEST_SECONDS)} disabled={test.kind === "sending"}>
            {t(delayedLabel.key, delayedLabel.params)}
          </button>
          {pending && <p role="status">{t(pending.key, pending.params)}</p>}
          {testStatus && <p role="status">{t(testStatus.key, testStatus.params)}</p>}
        </>
      ) : (
        <>
          <EnableReminders reminders={reminders} onEnable={enable} />
          {testStatus && <p role="status">{t(testStatus.key, testStatus.params)}</p>}
        </>
      )}
    </Card>
  );
}
