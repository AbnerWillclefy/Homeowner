import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { config } from "../../../shared/config";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { FormError } from "../../../shared/ui/FormError";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { useStableHandlers } from "../../../shared/ui/useStableHandlers";
import type { CognitoFailure, CognitoResult } from "../api/cognito";
import { EMAIL_MARKER, splitAtEmail } from "../logic/emailMarker";
import { failureMessage, fieldError } from "../logic/failureText";
import { createStepSubmitter } from "../logic/authSubmit";
import { evaluate } from "../logic/passwordPolicy";
import { ruleChange, type RuleChange } from "../logic/ruleAnnouncement";
import { announcementText } from "../logic/ruleText";
import { PasswordField } from "./PasswordField";
import { PasswordRules } from "./PasswordRules";

const ANNOUNCE_DELAY_MS = 600;
const FORM = "forgot";

type Step = { step: "email" } | { step: "code"; email: string };

interface Props {
  request(email: string): Promise<CognitoResult>;
  reset(email: string, code: string, password: string): Promise<CognitoResult>;
  /** The password was changed; go to sign-in with this email filled in. */
  onReset(email: string): void;
  onBack(): void;
}

/** Two steps in local state: ask for a code by email, then trade the code for a new password. */
export function ForgotPassword({ request, reset, onReset, onBack }: Props) {
  const { t } = useI18n();
  const [at, setAt] = useState<Step>({ step: "email" });
  const [busy, setBusy] = useState(false);
  // The failure, not its words, so a language switch re-words it.
  const [problem, setProblem] = useState<CognitoFailure | null>(null);
  const [password, setPassword] = useState("");
  const [announcement, setAnnouncement] = useState<RuleChange | null>(null);

  // Announce what changed once typing pauses, against the rules as last announced.
  const announced = useRef(evaluate(config.passwordPolicy, ""));
  useEffect(() => {
    const timer = setTimeout(() => {
      const now = evaluate(config.passwordPolicy, password);
      const next = ruleChange(announced.current, now, password);
      announced.current = now;
      if (next) setAnnouncement(next);
    }, ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [password]);

  const stable = useStableHandlers({ request, reset, onReset });
  const ask = useMemo(
    () =>
      createStepSubmitter({
        task: stable.request,
        onOk: (email: string) => setAt({ step: "code", email }),
        onBusy: setBusy,
        onProblem: setProblem,
      }),
    [stable],
  );
  const change = useMemo(
    () => createStepSubmitter({ task: stable.reset, onOk: (email: string) => stable.onReset(email), onBusy: setBusy, onProblem: setProblem }),
    [stable],
  );

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(String(new FormData(event.currentTarget).get("email") ?? "").trim());
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (at.step !== "code") return;
    const form = new FormData(event.currentTarget);
    void change(at.email, String(form.get("code") ?? "").trim(), String(form.get("password") ?? ""));
  }

  function startAgain() {
    setProblem(null);
    setPassword("");
    setAnnouncement(null);
    setAt({ step: "email" });
  }

  // No resend button here, so an expired code points at "Start again" instead.
  const message = problem && (problem.kind === "expired-code" ? t("forgot.failure.expiredCode") : failureMessage(t, problem, config.passwordPolicy));
  const back = (
    <p className="mt-2 text-center">
      <Button variant="link" onClick={onBack}>
        {t("forgot.back")}
      </Button>
    </p>
  );

  // The keys stop React reusing the email input as the code input, which would carry the typed email into it.
  if (at.step === "email") {
    return (
      <section key="email" aria-labelledby="forgot-heading">
        <PageHeader id="forgot-heading" title={t("forgot.heading")}>
          {t("forgot.intro")}
        </PageHeader>
        <Card>
          <form onSubmit={submitEmail}>
            <label htmlFor="forgot-email" className="mt-0">{t("signIn.emailLabel")}</label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              {...fieldError(problem, "email", FORM)}
            />
            <FormError form={FORM}>{message}</FormError>
            <Button type="submit" fullWidth className="mt-4" pending={busy}>
              {t("forgot.send")}
            </Button>
          </form>
        </Card>
        {back}
      </section>
    );
  }

  const [before, after] = splitAtEmail(t("forgot.sent", { email: EMAIL_MARKER }));
  return (
    <section key="code" aria-labelledby="forgot-heading">
      <PageHeader id="forgot-heading" title={t("forgot.heading")}>
        {before}
        <strong className="text-text [overflow-wrap:anywhere]">{at.email}</strong>
        {after}
      </PageHeader>
      <Card>
        <form
          onSubmit={submitCode}
          onChange={(event) => setPassword(String((event.currentTarget.elements.namedItem("password") as HTMLInputElement).value))}
        >
          <label htmlFor="forgot-code" className="mt-0">{t("confirm.codeLabel")}</label>
          <input
            id="forgot-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            autoCapitalize="none"
            spellCheck={false}
            required
            {...fieldError(problem, "code", FORM)}
          />
          <label htmlFor="forgot-password">{t("forgot.newPasswordLabel")}</label>
          <PasswordField
            id="forgot-password"
            name="password"
            autoComplete="new-password"
            required
            {...fieldError(problem, "password", FORM, "forgot-password-rules")}
          />
          <PasswordRules id="forgot-password-rules" rules={evaluate(config.passwordPolicy, password)} />
          <div role="status" aria-atomic="true" className="sr-only">
            {announcementText(t, announcement)}
          </div>
          <FormError form={FORM}>{message}</FormError>
          <Button type="submit" fullWidth className="mt-4" pending={busy}>
            {t("forgot.submit")}
          </Button>
        </form>
        <Button variant="secondary" fullWidth className="mt-3" onClick={startAgain} disabled={busy}>
          {t("forgot.startAgain")}
        </Button>
      </Card>
      {back}
    </section>
  );
}
