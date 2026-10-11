import { useState, type FormEvent } from "react";
import { config } from "../config";
import { useI18n, type MessageKey } from "../i18n";
import type { CognitoFailure, SignInResult } from "./cognito";
import { failureMessage } from "./failureText";
import { PasswordField } from "../components/ui/PasswordField";

interface Props {
  /** Prefilled after confirming an email. */
  initialEmail?: string;
  /** Shown above the form, for example after confirming. A key, so it follows the language. */
  noticeKey?: MessageKey;
  logIn(email: string, password: string): Promise<SignInResult>;
  /** The email was never confirmed: go to the code screen, where a new code can be sent. */
  onNeedsConfirm(email: string): void;
  onNeedsSignUp(): void;
}

export function SignIn({ initialEmail, noticeKey, logIn, onNeedsConfirm, onNeedsSignUp }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  // The failure, not its words, so a language switch re-words it.
  const [problem, setProblem] = useState<CognitoFailure | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true);
    setProblem(null);
    const result = await logIn(email, password);
    setBusy(false);
    // On success the app moves on to the signed-in view, so there is nothing to show here.
    if (result.kind === "not-confirmed") onNeedsConfirm(email);
    else if (result.kind !== "ok") setProblem(result);
  }

  return (
    <section aria-labelledby="signin-heading">
      <h2 id="signin-heading">{t("signIn.heading")}</h2>
      <p>{t("signIn.intro")}</p>
      {noticeKey && <p role="status">{t(noticeKey)}</p>}
      <form onSubmit={submit}>
        <label htmlFor="signin-email">{t("signIn.emailLabel")}</label>
        <input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          defaultValue={initialEmail}
          required
        />
        <label htmlFor="signin-password">{t("signIn.passwordLabel")}</label>
        <PasswordField id="signin-password" name="password" autoComplete="current-password" required />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t("signIn.submitting") : t("signIn.submit")}
        </button>
      </form>
      {problem && <p role="alert">{failureMessage(t, problem, config.passwordPolicy)}</p>}
      <p>
        {t("signIn.newHere")}{" "}
        <button type="button" className="btn-link" onClick={onNeedsSignUp}>
          {t("signIn.newHereAction")}
        </button>
      </p>
    </section>
  );
}
