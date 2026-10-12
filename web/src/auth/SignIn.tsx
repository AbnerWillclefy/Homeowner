import { useMemo, useState, type FormEvent } from "react";
import { config } from "../config";
import { useI18n } from "../i18n";
import { createSignInSubmitter } from "./authSubmit";
import type { CognitoFailure, SignInResult } from "./cognito";
import { failureMessage, fieldError } from "./failureText";
import { Card } from "../components/ui/Card";
import { FormError } from "../components/ui/FormError";
import { PasswordField } from "../components/ui/PasswordField";
import { PillButton } from "../components/ui/PillButton";
import { useStableHandlers } from "../components/ui/useStableHandlers";

interface Props {
  /** Prefilled after confirming an email. */
  initialEmail?: string;
  logIn(email: string, password: string): Promise<SignInResult>;
  /** The email was never confirmed: go to the code screen, where a new code can be sent. */
  onNeedsConfirm(email: string): void;
  onNeedsSignUp(): void;
}

const FORM = "signin";

export function SignIn({ initialEmail, logIn, onNeedsConfirm, onNeedsSignUp }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  // The failure, not its words, so a language switch re-words it.
  const [problem, setProblem] = useState<CognitoFailure | null>(null);

  // The guard lives in the submitter, so a second Enter in the same tick is ignored, not only a disabled button.
  const stable = useStableHandlers({ logIn, onNeedsConfirm });
  const submitter = useMemo(() => createSignInSubmitter({ ...stable, onBusy: setBusy, onProblem: setProblem }), [stable]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submitter(String(form.get("email") ?? "").trim(), String(form.get("password") ?? ""));
  }

  return (
    <Card as="section" aria-labelledby="signin-heading">
      <h2 id="signin-heading">{t("signIn.heading")}</h2>
      <p>{t("signIn.intro")}</p>
      <form onSubmit={submit}>
        <label htmlFor="signin-email">{t("signIn.emailLabel")}</label>
        <input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={initialEmail}
          required
          {...fieldError(problem, "email", FORM)}
        />
        <label htmlFor="signin-password">{t("signIn.passwordLabel")}</label>
        <PasswordField
          id="signin-password"
          name="password"
          autoComplete="current-password"
          required
          {...fieldError(problem, "password", FORM)}
        />
        <FormError form={FORM}>{problem && failureMessage(t, problem, config.passwordPolicy)}</FormError>
        <PillButton type="submit" className="mt-4 w-full" disabled={busy} aria-busy={busy}>
          {busy ? t("signIn.submitting") : t("signIn.submit")}
        </PillButton>
      </form>
      <p className="mt-4 text-center">
        {t("signIn.newHere")}{" "}
        <button type="button" className="btn-link" onClick={onNeedsSignUp}>
          {t("signIn.newHereAction")}
        </button>
      </p>
    </Card>
  );
}
