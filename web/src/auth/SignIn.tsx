import { useState, type FormEvent } from "react";
import type { SignInResult } from "./cognito";
import { failureText } from "./failureText";
import { PasswordField } from "../components/ui/PasswordField";

interface Props {
  /** Prefilled after confirming an email. */
  initialEmail?: string;
  /** Shown above the form, for example after confirming. */
  notice?: string;
  logIn(email: string, password: string): Promise<SignInResult>;
  /** The email was never confirmed: go to the code screen, where a new code can be sent. */
  onNeedsConfirm(email: string): void;
  onNeedsSignUp(): void;
}

export function SignIn({ initialEmail, notice, logIn, onNeedsConfirm, onNeedsSignUp }: Props) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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
    else if (result.kind !== "ok") setProblem(failureText(result));
  }

  return (
    <section aria-labelledby="signin-heading">
      <h2 id="signin-heading">Sign in</h2>
      <p>
        Signing in tells Homeowner whose Check-in and Tasks to show. You stay signed in on this device until you sign
        out.
      </p>
      {notice && <p role="status">{notice}</p>}
      <form onSubmit={submit}>
        <label htmlFor="signin-email">Email</label>
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
        <label htmlFor="signin-password">Password</label>
        <PasswordField id="signin-password" name="password" autoComplete="current-password" required />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {problem && <p role="alert">{problem}</p>}
      <p>
        New here?{" "}
        <button type="button" className="btn-link" onClick={onNeedsSignUp}>
          Sign up
        </button>
      </p>
    </section>
  );
}
