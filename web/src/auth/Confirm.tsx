import { useState, type FormEvent } from "react";
import { config } from "../config";
import { useI18n } from "../i18n";
import type { CognitoFailure, CognitoResult } from "./cognito";
import { EMAIL_MARKER, splitAtEmail } from "./emailMarker";
import { failureField, failureMessage } from "./failureText";
import { Card } from "../components/ui/Card";
import { FormError } from "../components/ui/FormError";
import { PillButton } from "../components/ui/PillButton";

const ERROR_ID = "confirm-error";

interface Props {
  email: string;
  confirm(email: string, code: string): Promise<CognitoResult>;
  resend(email: string): Promise<CognitoResult>;
  onConfirmed(email: string): void;
  onBack(): void;
}

export function Confirm({ email, confirm, resend, onConfirmed, onBack }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  // State holds the failure and a flag, never their words, so a language switch re-words them.
  const [problem, setProblem] = useState<CognitoFailure | null>(null);
  const [resent, setResent] = useState(false);
  const aboutCode = problem !== null && failureField(problem) === "code";
  const [before, after] = splitAtEmail(t("confirm.intro", { email: EMAIL_MARKER }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    setBusy(true);
    setProblem(null);
    setResent(false);
    const result = await confirm(email, code);
    setBusy(false);
    if (result.kind === "ok") onConfirmed(email);
    else setProblem(result);
  }

  async function sendAgain() {
    setBusy(true);
    setProblem(null);
    setResent(false);
    const result = await resend(email);
    setBusy(false);
    if (result.kind === "ok") setResent(true);
    else setProblem(result);
  }

  return (
    <Card as="section" aria-labelledby="confirm-heading">
      <h2 id="confirm-heading">{t("confirm.heading")}</h2>
      <p>
        {before}
        <strong>{email}</strong>
        {after}
      </p>
      <p id="confirm-spam-hint" className="my-1 text-sm text-muted">
        {t("confirm.spamHint")}
      </p>
      <form onSubmit={submit}>
        <label htmlFor="confirm-code">{t("confirm.codeLabel")}</label>
        <input
          id="confirm-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={aboutCode || undefined}
          aria-describedby={aboutCode ? `confirm-spam-hint ${ERROR_ID}` : "confirm-spam-hint"}
        />
        <FormError id={ERROR_ID}>{problem && failureMessage(t, problem, config.passwordPolicy)}</FormError>
        <div role="status">{resent && <p className="mt-4 font-semibold">{t("confirm.resent")}</p>}</div>
        <PillButton type="submit" className="mt-4 w-full" disabled={busy}>
          {busy ? t("confirm.submitting") : t("confirm.submit")}
        </PillButton>
      </form>
      <PillButton variant="secondary" className="mt-3 w-full" onClick={sendAgain} disabled={busy}>
        {t("confirm.resend")}
      </PillButton>
      <p className="mt-2 text-center">
        <button type="button" className="btn-link" onClick={onBack}>
          {t("confirm.useOtherEmail")}
        </button>
      </p>
    </Card>
  );
}
