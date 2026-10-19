import { useMemo, useState, type FormEvent } from "react";
import { config } from "../../../shared/config";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { createSignInSubmitter } from "../logic/authSubmit";
import type { CognitoFailure, SignInResult } from "../api/cognito";
import { failureMessage, fieldError } from "../logic/failureText";
import { Card } from "../../../shared/ui/Card";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { FormError } from "../../../shared/ui/FormError";
import { PasswordField } from "./PasswordField";
import { useStableHandlers } from "../../../shared/ui/useStableHandlers";

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
    <section aria-labelledby="signin-heading">
      <PageHeader id="signin-heading" title={t("signIn.heading")}>
        {t("signIn.hint")}
      </PageHeader>
      <Card>
        <form onSubmit={submit}>
          <label htmlFor="signin-email" className="mt-0">{t("signIn.emailLabel")}</label>
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
          <Button type="submit" fullWidth className="mt-4" pending={busy}>
            {t("signIn.submit")}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center">
        {t("signIn.newHere")}{" "}
        <Button variant="link" onClick={onNeedsSignUp}>
          {t("signIn.newHereAction")}
        </Button>
      </p>
    </section>
  );
}
