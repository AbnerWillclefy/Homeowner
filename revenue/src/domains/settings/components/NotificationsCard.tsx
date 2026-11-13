import { Banner, Card, Switch } from "@homeowner/bedrock";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useNotifications } from "../hooks/useNotifications";
import { problemText } from "../logic/problemText";

const INSTALL_STEPS = ["notify.install.step1", "notify.install.step2", "notify.install.step3", "notify.install.step4"] as const;

/** The notifications switch. Off by default; the browser's permission is asked only when it is turned on. */
export function NotificationsCard() {
  const { t } = useI18n();
  const { availability, state, turn } = useNotifications();
  const problem = state.kind === "problem" ? problemText(state.problem) : null;
  return (
    <Card className="gap-4">
      <h2 className="section-title">{t("notify.title")}</h2>
      <p className="body text-text-muted">{t("notify.hint")}</p>
      {availability.kind === "available" && (
        <Switch label={t("notify.switch")} checked={state.kind === "on"} disabled={state.kind === "working"} onCheckedChange={(on) => void turn(on)} />
      )}
      {availability.kind === "needs-install" && (
        <div className="flex flex-col gap-2">
          <p className="body">{t("notify.install.intro")}</p>
          <ol className="body list-decimal ps-6">
            {INSTALL_STEPS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ol>
        </div>
      )}
      {availability.kind === "unsupported" && <Banner>{t("notify.unsupported")}</Banner>}
      {problem && <Banner tone={state.kind === "problem" && state.problem.kind === "denied" ? "warning" : "danger"}>{t(problem.key, problem.params)}</Banner>}
    </Card>
  );
}
