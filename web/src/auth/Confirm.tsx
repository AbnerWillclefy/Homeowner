import { useMemo, useState, type FormEvent } from "react";
import { config } from "../config";
import { useI18n } from "../i18n";
import { createConfirmSubmitter } from "./authSubmit";
import type { CognitoFailure, CognitoResult } from "./cognito";
import { EMAIL_MARKER, splitAtEmail } from "./emailMarker";
import { failureMessage, fieldError } from "./failureText";
import { Card } from "../components/ui/Card";
import { FormError } from "../components/ui/FormError";
import { useStableHandlers } from "../components/ui/useStableHandlers";
import { useToast } from "../components/ui/useToast";
import { PillButton } from "../components/ui/PillButton";

const FORM = "confirm";

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
  const toast = useToast();
  const [before, after] = splitAtEmail(t("confirm.intro", { email: EMAIL_MARKER }));

  // One guard for confirming and resending: either one in flight holds the other, and a repeat is ignored.
  const stable = useStableHandlers({ confirm, resend, onConfirmed });
  const form = useMemo(
    () =>
      createConfirmSubmitter({
        ...stable,
        onBusy: setBusy,
        onProblem: setProblem,
        // A new code was sent and nothing is left to decide: a toast, not a message the form has to clear.
        onResent: () => toast.show({ messageKey: "confirm.resent", tone: "success" }),
      }),
    [stable, toast],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void form.submit(email, String(new FormData(event.currentTarget).get("code") ?? "").trim());
  }

  function sendAgain() {
    void form.resend(email);
  }

  return (
    <Card as="section" aria-labelledby="confirm-heading">
      <h2 id="confirm-heading">{t("confirm.heading")}</h2>
      <p>
        {before}
        <strong>{email}</strong>
        {after}
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
          {...fieldError(problem, "code", FORM)}
        />
        <FormError form={FORM}>{problem && failureMessage(t, problem, config.passwordPolicy)}</FormError>
        <PillButton type="submit" className="mt-4 w-full" disabled={busy} aria-busy={busy}>
          {busy ? t("confirm.submitting") : t("confirm.submit")}
        </PillButton>
      </form>
      <PillButton variant="secondary" className="mt-3 w-full" onClick={sendAgain} disabled={busy} aria-busy={busy}>
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
