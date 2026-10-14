import { useMemo, useState, type FormEvent } from "react";
import { config } from "../../../shared/config";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { createConfirmSubmitter } from "../logic/authSubmit";
import type { CognitoFailure, CognitoResult } from "../api/cognito";
import { EMAIL_MARKER, splitAtEmail } from "../logic/emailMarker";
import { failureMessage, fieldError } from "../logic/failureText";
import { Card } from "../../../shared/ui/Card";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { FormError } from "../../../shared/ui/FormError";
import { useStableHandlers } from "../../../shared/ui/useStableHandlers";
import { useToast } from "../../../shared/ui/useToast";

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
    <section aria-labelledby="confirm-heading">
      <PageHeader id="confirm-heading" title={t("confirm.heading")}>
        {before}
        <strong className="text-text [overflow-wrap:anywhere]">{email}</strong>
        {after}
      </PageHeader>
      <Card>
        <form onSubmit={submit}>
          <label htmlFor="confirm-code" className="mt-0">
            {t("confirm.codeLabel")}
          </label>
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
          <Button type="submit" fullWidth className="mt-4" disabled={busy} aria-busy={busy}>
            {busy ? t("confirm.submitting") : t("confirm.submit")}
          </Button>
        </form>
        <Button variant="secondary" fullWidth className="mt-3" onClick={sendAgain} disabled={busy} aria-busy={busy}>
          {t("confirm.resend")}
        </Button>
      </Card>
      <p className="mt-2 text-center">
        <Button variant="link" onClick={onBack}>
          {t("confirm.useOtherEmail")}
        </Button>
      </p>
    </section>
  );
}
