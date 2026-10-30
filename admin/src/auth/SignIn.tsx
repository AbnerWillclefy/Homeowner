import { useId, useState, type FormEvent } from "react";
import { Button } from "../shared/Button";
import { useAuth } from "./AuthContext";
import type { CognitoFailure } from "./cognito";

const MESSAGES: Record<CognitoFailure["kind"], string> = {
  "not-authorized": "The email or password is wrong.",
  "not-confirmed": "This account has not confirmed its email yet. Confirm it in the Homeowner app first.",
  "rate-limited": "Too many attempts. Wait a few minutes and try again.",
  network: "Could not reach the sign-in service. Check your connection and try again.",
  error: "Sign-in failed. Try again.",
};

export function SignIn() {
  const { signIn } = useAuth();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<CognitoFailure | null>(null);
  const errorId = useId();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFailure(null);
    const result = await signIn(String(form.get("email") ?? "").trim(), String(form.get("password") ?? ""));
    setPending(false);
    // On success the session store changes and this screen is replaced.
    setFailure(result);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto my-12 w-full max-w-sm rounded-card border border-border/50 bg-surface-raised p-6"
      aria-describedby={failure ? errorId : undefined}
    >
      <h1>Sign in</h1>
      <p className="text-sm text-muted">Use the account you use in the Homeowner app. Only the maintainer is allowed in.</p>
      {failure !== null && (
        <p id={errorId} role="alert" className="rounded-control border-l-4 border-danger bg-surface px-3 py-2 text-sm font-semibold text-danger">
          {MESSAGES[failure.kind]}
        </p>
      )}
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" className="mt-6 w-full" disabled={pending} aria-busy={pending || undefined}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
