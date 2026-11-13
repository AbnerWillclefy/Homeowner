import { Banner, Button, Input } from "@homeowner/bedrock";
import { Check, Circle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { config } from "../config";
import { CenteredCard } from "../shared/CenteredCard";
import { useI18n } from "../shared/i18n/I18nProvider";
import type { MessageKey } from "../shared/i18n/catalogs";
import { confirmForgotPassword, forgotPassword, type StepResult } from "./cognito";
import { evaluate } from "./passwordPolicy";

type Step = { name: "email" } | { name: "code"; email: string } | { name: "done" };

const ERROR_KINDS = ["code-mismatch", "code-expired", "invalid-password", "rate-limited", "network"];
const errorKey = (kind: string) => `forgot.error.${ERROR_KINDS.includes(kind) ? kind : "error"}` as MessageKey;

export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>({ name: "email" });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  async function run(action: () => Promise<StepResult>, onOk: () => void) {
    setPending(true);
    setFailure(null);
    const result = await action();
    setPending(false);
    if (result.kind === "ok") onOk();
    else setFailure(result.kind);
  }

  function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    void run(() => forgotPassword(email), () => setStep({ name: "code", email }));
  }

  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.name !== "code") return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    void run(() => confirmForgotPassword(step.email, code, password), () => setStep({ name: "done" }));
  }

  const error = failure && <Banner tone="danger">{t(errorKey(failure))}</Banner>;
  const back = (
    <Button variant="ghost" onClick={onBack}>
      {t("forgot.back")}
    </Button>
  );

  if (step.name === "done") {
    return (
      <CenteredCard title={t("forgot.title")}>
        <Banner tone="neutral">{t("forgot.done")}</Banner>
        <Button onClick={onBack}>{t("forgot.back")}</Button>
      </CenteredCard>
    );
  }

  if (step.name === "code") {
    return (
      <CenteredCard title={t("forgot.title")}>
        {/* Always the same words: nothing here says whether the email has a login. */}
        <Banner tone="neutral">{t("forgot.sent")}</Banner>
        <form key="code" onSubmit={confirm} className="flex flex-col gap-4">
          {error}
          <Input label={t("forgot.code")} hint={t("forgot.codeHint")} name="code" inputMode="numeric" autoComplete="one-time-code" required />
          <Input
            label={t("forgot.newPassword")}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div>
            <p className="caption text-text-muted">{t("forgot.rules")}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {evaluate(config.passwordPolicy, password).map((rule) => (
                <li key={rule.id} className="body flex items-center gap-2">
                  {rule.met ? <Check className="size-4 shrink-0 text-positive" aria-hidden /> : <Circle className="size-4 shrink-0 text-text-muted" aria-hidden />}
                  <span>{t(`forgot.rule.${rule.id}`, { count: config.passwordPolicy.minimumLength })}</span>
                </li>
              ))}
            </ul>
          </div>
          <Button type="submit" size="lg" loading={pending}>
            {pending ? t("forgot.confirming") : t("forgot.confirm")}
          </Button>
        </form>
        <Button variant="secondary" onClick={() => { setFailure(null); setStep({ name: "email" }); }}>
          {t("forgot.again")}
        </Button>
        {back}
      </CenteredCard>
    );
  }

  return (
    <CenteredCard title={t("forgot.title")}>
      <p className="body text-text-muted">{t("forgot.intro")}</p>
      <form key="email" onSubmit={sendCode} className="flex flex-col gap-4">
        {error}
        <Input label={t("forgot.email")} name="email" type="email" autoComplete="username" required />
        <Button type="submit" size="lg" loading={pending}>
          {pending ? t("forgot.sending") : t("forgot.send")}
        </Button>
      </form>
      {back}
    </CenteredCard>
  );
}
