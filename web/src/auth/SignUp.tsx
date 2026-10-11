import { useState, type FocusEvent, type FormEvent } from "react";
import { TriangleAlert } from "lucide-react";
import type { CognitoResult } from "./cognito";
import { PASSWORD_RULES, failureText } from "./failureText";
import { PasswordField } from "../components/ui/PasswordField";

interface Props {
  register(email: string, password: string): Promise<CognitoResult>;
  /** The sign-up went through; the email now needs confirming. */
  onRegistered(email: string): void;
  onHaveLogin(): void;
}

export function SignUp({ register, onRegistered, onHaveLogin }: Props) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const [mismatch, setMismatch] = useState(false);

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

  function clearOnMatch(event: FormEvent<HTMLFormElement>) {
    if (!mismatch) return;
    const { password, confirm } = values(event.currentTarget);
    if (confirm === password) setMismatch(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { password: first, confirm } = values(event.currentTarget);
    if (first !== confirm) {
      setMismatch(true);
      (event.currentTarget.elements.namedItem("signup-confirm") as HTMLInputElement).focus();
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true);
    setProblem(null);
    const result = await register(email, password);
    setBusy(false);
    if (result.kind === "ok") onRegistered(email);
    else setProblem(failureText(result));
  }

  return (
    <section aria-labelledby="signup-heading">
      <h2 id="signup-heading">Sign up</h2>
      <p>
        Homeowner is for the people who look after a Home together. Signing up gives you a login of your own, so your
        Baseline, Preferences and Restrictions are yours and follow you, whoever else lives in the Home.
      </p>
      <form onSubmit={submit} onBlur={checkOnBlur} onChange={clearOnMatch}>
        <label htmlFor="signup-email">Email</label>
        <p id="signup-email-why" className="my-1 text-sm text-muted">
          Your email is your login. We also send a code to it in the next step, which proves the email is really yours.
        </p>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          required
          aria-describedby="signup-email-why"
        />

        <label htmlFor="signup-password">Password</label>
        <p id="signup-password-why" className="my-1 text-sm text-muted">
          It keeps anyone else from signing in as you. {PASSWORD_RULES}
        </p>
        <PasswordField
          id="signup-password"
          name="password"
          autoComplete="new-password"
          minLength={10}
          required
          aria-describedby="signup-password-why"
        />

        <label htmlFor="signup-confirm">Confirm password</label>
        <PasswordField
          id="signup-confirm"
          autoComplete="new-password"
          required
          aria-describedby={mismatch ? "signup-confirm-mismatch" : undefined}
          aria-invalid={mismatch || undefined}
        />
        <div role="status">
          {mismatch && (
            <p id="signup-confirm-mismatch" className="my-1 text-sm text-danger">
              <TriangleAlert aria-hidden="true" size={16} className="mr-1 inline shrink-0" />
              The two passwords do not match.
            </p>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Signing up..." : "Sign up"}
        </button>
      </form>
      {problem && <p role="alert">{problem}</p>}
      <p>
        Already signed up?{" "}
        <button type="button" className="btn-link" onClick={onHaveLogin}>
          Sign in
        </button>
      </p>
    </section>
  );
}
