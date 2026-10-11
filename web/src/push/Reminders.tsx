import { useI18n } from "../i18n";
import { INSTALL_STEP_KEYS } from "./installSteps";
import { problemText, type RemindersProblem } from "./problemText";
import { DELAYED_TEST_SECONDS, delayedTestLabel, testPendingText, testStatusText } from "./testText";
import { usePush } from "./usePush";

function InstallSteps() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="install-heading">
      <h2 id="install-heading">{t("install.heading")}</h2>
      <p>{t("install.intro")}</p>
      <ol>
        {INSTALL_STEP_KEYS.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ol>
      <p>{t("install.outro")}</p>
    </section>
  );
}

export function Reminders() {
  const { availability, reminders, enable, test, sendTest } = usePush();
  const { t } = useI18n();

  if (availability.kind === "needs-install") return <InstallSteps />;

  if (availability.kind === "unsupported") {
    return (
      <section aria-labelledby="reminders-heading">
        <h2 id="reminders-heading">{t("reminders.heading")}</h2>
        <p>{t("reminders.unsupported")}</p>
      </section>
    );
  }

  const delayedLabel = delayedTestLabel(test.kind === "sending" && !!test.delaySeconds);
  const pending = test.kind === "sending" ? testPendingText(test.delaySeconds) : null;
  const testStatus = test.kind === "done" ? testStatusText(test.result, test.delaySeconds) : null;

  return (
    <section aria-labelledby="reminders-heading">
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
          <button type="button" className="btn btn-primary" onClick={enable} disabled={reminders.kind === "working"}>
            {reminders.kind === "working" ? t("reminders.enabling") : t("reminders.enable")}
          </button>
          {reminders.kind === "problem" && <ProblemMessage problem={reminders.problem} />}
          {testStatus && <p role="status">{t(testStatus.key, testStatus.params)}</p>}
        </>
      )}
    </section>
  );
}

function ProblemMessage({ problem }: { problem: RemindersProblem }) {
  const { t } = useI18n();
  const text = problemText(problem);
  return <p role="alert">{t(text.key, text.params)}</p>;
}
