import { useState, type FormEvent } from "react";
import { config } from "../config";
import { useI18n } from "../i18n";
import type { CognitoFailure, CognitoResult } from "./cognito";
import { EMAIL_MARKER, splitAtEmail } from "./emailMarker";
import { failureMessage } from "./failureText";

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
    <section aria-labelledby="confirm-heading">
      <h2 id="confirm-heading">{t("confirm.heading")}</h2>
      <p>
        {before}
        <strong>{email}</strong>
        {after}
      </p>
      <p className="my-1 text-sm text-muted">{t("confirm.spamHint")}</p>
      <form onSubmit={submit}>
        <label htmlFor="confirm-code">{t("confirm.codeLabel")}</label>
        <input
          id="confirm-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          required
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t("confirm.submitting") : t("confirm.submit")}
        </button>
      </form>
      {problem && <p role="alert">{failureMessage(t, problem, config.passwordPolicy)}</p>}
      {resent && <p role="status">{t("confirm.resent")}</p>}
      <p>
        <button type="button" className="btn" onClick={sendAgain} disabled={busy}>
          {t("confirm.resend")}
        </button>{" "}
        <button type="button" className="btn-link" onClick={onBack}>
          {t("confirm.useOtherEmail")}
        </button>
      </p>
    </section>
  );
}
