import { useEffect, useMemo, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { TriangleAlert } from "lucide-react";
import { createSignUpSubmitter } from "./authSubmit";
import type { CognitoFailure, CognitoResult } from "./cognito";
import { config } from "../config";
import { useI18n } from "../i18n";
import { failureMessage, fieldError } from "./failureText";
import { evaluate } from "./passwordPolicy";
import { ruleChange, type RuleChange } from "./ruleAnnouncement";
import { announcementText } from "./ruleText";
import { Card } from "../components/ui/Card";
import { FormError } from "../components/ui/FormError";
import { PasswordField } from "../components/ui/PasswordField";
import { PasswordRules } from "../components/ui/PasswordRules";
import { Button } from "../shared/ui/Button";
import { useStableHandlers } from "../components/ui/useStableHandlers";

const ANNOUNCE_DELAY_MS = 600;
const FORM = "signup";

interface Props {
  register(email: string, password: string): Promise<CognitoResult>;
  /** The sign-up went through; the email now needs confirming. */
  onRegistered(email: string): void;
  onHaveLogin(): void;
}

export function SignUp({ register, onRegistered, onHaveLogin }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  // State holds the failure and the rule change, never their words, so a language switch re-words them.
  const [problem, setProblem] = useState<CognitoFailure | null>(null);

  const [mismatch, setMismatch] = useState(false);
  const [password, setPassword] = useState("");
  const [change, setChange] = useState<RuleChange | null>(null);
  const rules = evaluate(config.passwordPolicy, password);

  // Announce what changed once typing pauses, against the rules as last announced.
  const announced = useRef(evaluate(config.passwordPolicy, ""));
  useEffect(() => {
    const timer = setTimeout(() => {
      const now = evaluate(config.passwordPolicy, password);
      const next = ruleChange(announced.current, now, password);
      announced.current = now;
      if (next) setChange(next);
    }, ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [password]);

  function values(form: HTMLFormElement) {
    const field = (id: string) => (form.elements.namedItem(id) as HTMLInputElement).value;
    return { password: field("signup-password"), confirm: field("signup-confirm") };
  }

  // Advise once the user leaves the confirmation; clear the moment the two agree.
  function checkOnBlur(event: FocusEvent<HTMLFormElement>) {
    if (event.target.id !== "signup-confirm") return;
    const { password, confirm } = values(event.currentTarget);
    if (confirm !== "" && confirm !== password) setMismatch(true);
  }

  function onFormChange(event: FormEvent<HTMLFormElement>) {
    const { password: first, confirm } = values(event.currentTarget);
    setPassword(first);
    if (mismatch && confirm === first) setMismatch(false);
  }

  // The guard lives in the submitter, so a second Enter in the same tick is ignored, not only a disabled button.
  const stable = useStableHandlers({ register, onRegistered });
  const submitter = useMemo(() => createSignUpSubmitter({ ...stable, onBusy: setBusy, onProblem: setProblem }), [stable]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { password: first, confirm } = values(event.currentTarget);
    if (first !== confirm) {
      setMismatch(true);
      (event.currentTarget.elements.namedItem("signup-confirm") as HTMLInputElement).focus();
      return;
    }
    const form = new FormData(event.currentTarget);
    void submitter(String(form.get("email") ?? "").trim(), String(form.get("password") ?? ""));
  }

  return (
    <Card as="section" aria-labelledby="signup-heading">
      <h2 id="signup-heading">{t("signUp.heading")}</h2>
      <form onSubmit={submit} onBlur={checkOnBlur} onChange={onFormChange}>
        <label htmlFor="signup-email">{t("signUp.emailLabel")}</label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          {...fieldError(problem, "email", FORM)}
        />

        <label htmlFor="signup-password">{t("signUp.passwordLabel")}</label>
        <PasswordRules id="signup-password-rules" rules={rules} />
        <div role="status" aria-atomic="true" className="sr-only">
          {announcementText(t, change)}
        </div>
        <PasswordField
          id="signup-password"
          name="password"
          autoComplete="new-password"
          required
          {...fieldError(problem, "password", FORM, "signup-password-rules")}
        />

        <label htmlFor="signup-confirm">{t("signUp.confirmLabel")}</label>
        <PasswordField
          id="signup-confirm"
          name="confirm-password"
          autoComplete="new-password"
          required
          aria-describedby={mismatch ? "signup-confirm-mismatch" : undefined}
          aria-invalid={mismatch || undefined}
        />
        <div role="status">
          {mismatch && (
            <p id="signup-confirm-mismatch" className="my-1 text-sm text-danger">
              <TriangleAlert aria-hidden="true" size={16} className="mr-1 inline shrink-0" />
              {t("signUp.mismatch")}
            </p>
          )}
        </div>

        <FormError form={FORM}>{problem && failureMessage(t, problem, config.passwordPolicy)}</FormError>
        <Button type="submit" className="mt-4 w-full" disabled={busy} aria-busy={busy}>
          {busy ? t("signUp.submitting") : t("signUp.submit")}
        </Button>
      </form>
      <p className="mt-4 text-center">
        {t("signUp.haveLogin")}{" "}
        <button type="button" className="btn-link" onClick={onHaveLogin}>
          {t("signUp.haveLoginAction")}
        </button>
      </p>
    </Card>
  );
}
