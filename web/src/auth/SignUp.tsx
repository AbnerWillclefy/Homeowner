import { useState, type FormEvent } from "react";
import type { CognitoResult } from "./cognito";
import { PASSWORD_RULES, failureText } from "./failureText";

interface Props {
  register(email: string, password: string): Promise<CognitoResult>;
  /** The sign-up went through; the email now needs confirming. */
  onRegistered(email: string): void;
  onHaveLogin(): void;
}

export function SignUp({ register, onRegistered, onHaveLogin }: Props) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      <form onSubmit={submit}>
        <label htmlFor="signup-email">Email</label>
        <p id="signup-email-why" className="hint">
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
        <p id="signup-password-why" className="hint">
          It keeps anyone else from signing in as you. {PASSWORD_RULES}
        </p>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          aria-describedby="signup-password-why"
        />

        <button type="submit" disabled={busy}>
          {busy ? "Signing up..." : "Sign up"}
        </button>
      </form>
      {problem && <p role="alert">{problem}</p>}
      <p>
        Already signed up?{" "}
        <button type="button" className="link" onClick={onHaveLogin}>
          Sign in
        </button>
      </p>
    </section>
  );
}
