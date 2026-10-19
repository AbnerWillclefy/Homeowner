import { guardOnce } from "../../../shared/ui/guardOnce";
import type { CognitoFailure, CognitoResult, SignInResult } from "../api/cognito";

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
  return guardOnce(
    (email: string, password: string) =>
      attempt(onProblem, () => register(email, password), () => onRegistered(email)),
    onBusy,
  );
}

/** Clears the previous failure, runs `task`, then calls `onOk` on success or hands the failure to `onProblem`. */
async function attempt(
  onProblem: Common["onProblem"],
  task: () => Promise<CognitoResult>,
  onOk: () => void,
): Promise<void> {
  onProblem(null);
  const result = await task();
  if (result.kind === "ok") onOk();
  else onProblem(result);
}

/** Which of the code screen's two buttons is running. */
export type ConfirmAction = "submit" | "resend";

interface ConfirmDeps extends Common {
  confirm(email: string, code: string): Promise<CognitoResult>;
  resend(email: string): Promise<CognitoResult>;
  /** A new code was sent. */
  onResent(): void;
  onConfirmed(email: string): void;
  /** The action in flight, or `null` when none: only that button shows the spinner. A call the guard ignores is not reported. */
  onRunning(action: ConfirmAction | null): void;
}

/** Confirming and resending share one guard: either one in flight holds the other. */
export function createConfirmSubmitter({ confirm, resend, onBusy, onProblem, onResent, onConfirmed, onRunning }: ConfirmDeps) {
  const run = guardOnce(async (action: ConfirmAction, go: () => Promise<void>) => {
    onRunning(action);
    try {
      await go();
    } finally {
      onRunning(null);
    }
  }, onBusy);
  return {
    submit: (email: string, code: string) =>
      run("submit", () => attempt(onProblem, () => confirm(email, code), () => onConfirmed(email))),
    resend: (email: string) => run("resend", () => attempt(onProblem, () => resend(email), onResent)),
  };
}
