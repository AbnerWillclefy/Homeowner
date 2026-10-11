import { useState, type FormEvent } from "react";
import type { CognitoResult } from "./cognito";
import { failureText } from "./failureText";

interface Props {
  email: string;
  confirm(email: string, code: string): Promise<CognitoResult>;
  resend(email: string): Promise<CognitoResult>;
  onConfirmed(email: string): void;
  onBack(): void;
}

export function Confirm({ email, confirm, resend, onConfirmed, onBack }: Props) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    setBusy(true);
    setProblem(null);
    setNotice(null);
    const result = await confirm(email, code);
    setBusy(false);
    if (result.kind === "ok") onConfirmed(email);
    else setProblem(failureText(result));
  }

  async function sendAgain() {
    setBusy(true);
    setProblem(null);
    setNotice(null);
    const result = await resend(email);
    setBusy(false);
    if (result.kind === "ok") setNotice("A new code is on its way. Use the latest email.");
    else setProblem(failureText(result));
  }

  return (
    <section aria-labelledby="confirm-heading">
      <h2 id="confirm-heading">Confirm your email</h2>
      <p>
        We sent a code to <strong>{email}</strong>. Entering it proves the email is yours, so nobody can sign up in your
        name or take over your Preferences. Until you do, you cannot sign in.
      </p>
      <p className="my-1 text-sm text-muted">The email can take a minute, and it may land in your spam folder.</p>
      <form onSubmit={submit}>
        <label htmlFor="confirm-code">Code from the email</label>
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
          {busy ? "Checking..." : "Confirm"}
        </button>
      </form>
      {problem && <p role="alert">{problem}</p>}
      {notice && <p role="status">{notice}</p>}
      <p>
        <button type="button" className="btn" onClick={sendAgain} disabled={busy}>
          Send a new code
        </button>{" "}
        <button type="button" className="btn-link" onClick={onBack}>
          Use a different email
        </button>
      </p>
    </section>
  );
}
