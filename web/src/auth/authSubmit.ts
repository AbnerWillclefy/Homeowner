import { guardOnce } from "../components/ui/guardOnce";
import type { CognitoFailure, CognitoResult, SignInResult } from "./cognito";

/*
 * The auth forms' submits as plain functions, each guarded so a second call while one is in flight (a double
 * click, or Enter pressed twice) is ignored. A failure re-arms the guard, so the retry sends again. The failure
 * is handed over as data (never its words), so a language switch re-words it. `onBusy` drives `disabled` and
 * `aria-busy` on the button.
 */

interface Common {
  onBusy(busy: boolean): void;
  /** `null` clears the previous failure when a new try starts. */
  onProblem(problem: CognitoFailure | null): void;
}

interface SignInDeps extends Common {
  logIn(email: string, password: string): Promise<SignInResult>;
  /** The email was never confirmed: go to the code screen. */
  onNeedsConfirm(email: string): void;
}

export function createSignInSubmitter({ logIn, onBusy, onProblem, onNeedsConfirm }: SignInDeps) {
  return guardOnce(async (email: string, password: string) => {
    onProblem(null);
    const result = await logIn(email, password);
    // On success the app moves on to the signed-in view, so there is nothing to show here.
    if (result.kind === "not-confirmed") onNeedsConfirm(email);
    else if (result.kind !== "ok") onProblem(result);
  }, onBusy);
}

interface SignUpDeps extends Common {
  register(email: string, password: string): Promise<CognitoResult>;
  onRegistered(email: string): void;
}

export function createSignUpSubmitter({ register, onBusy, onProblem, onRegistered }: SignUpDeps) {
  return guardOnce(async (email: string, password: string) => {
    onProblem(null);
    const result = await register(email, password);
    if (result.kind === "ok") onRegistered(email);
    else onProblem(result);
  }, onBusy);
}

interface ConfirmDeps extends Common {
  confirm(email: string, code: string): Promise<CognitoResult>;
  resend(email: string): Promise<CognitoResult>;
  /** A new code was sent. */
  onResent(): void;
  onConfirmed(email: string): void;
}

/** Confirming and resending share one guard: either one in flight holds the other. */
export function createConfirmSubmitter({ confirm, resend, onBusy, onProblem, onResent, onConfirmed }: ConfirmDeps) {
  const run = guardOnce(async (action: { type: "confirm"; email: string; code: string } | { type: "resend"; email: string }) => {
    onProblem(null);
    if (action.type === "confirm") {
      const result = await confirm(action.email, action.code);
      if (result.kind === "ok") onConfirmed(action.email);
      else onProblem(result);
    } else {
      const result = await resend(action.email);
      if (result.kind === "ok") onResent();
      else onProblem(result);
    }
  }, onBusy);
  return {
    submit: (email: string, code: string) => run({ type: "confirm", email, code }),
    resend: (email: string) => run({ type: "resend", email }),
  };
}
