import { useCallback, useEffect, useState } from "react";
import { getMe } from "../api/meApi";
import { browserSession } from "../logic/browserSession";
import { confirmSignUp, resendCode, signIn, signUp, type CognitoResult, type SignInResult } from "../api/cognito";
import { emailFromIdToken } from "../logic/session";

export type AuthState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  /** offline: a stored session is kept but the API could not be reached, so the email comes from the stored token. */
  | { kind: "signed-in"; email: string | null; offline: boolean };

async function resolveSignedIn(): Promise<AuthState> {
  const stored = browserSession.load();
  if (stored === null) return { kind: "signed-out" };
  const me = await getMe();
  switch (me.kind) {
    case "ok":
      return { kind: "signed-in", email: me.email, offline: false };
    case "not-signed-in":
      return { kind: "signed-out" };
    default:
      // The API is unreachable or failing; only a rejected session signs the person out.
      return { kind: "signed-in", email: emailFromIdToken(stored.idToken), offline: true };
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void resolveSignedIn().then((next) => {
      if (!cancelled) setState(next);
    });
    // authedFetch clears the session when Cognito and the API both turn it down: go back to sign-in.
    const off = browserSession.subscribe(() => {
      if (browserSession.load() === null) setState({ kind: "signed-out" });
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const register = useCallback((email: string, password: string): Promise<CognitoResult> => signUp(email, password), []);
  const confirm = useCallback((email: string, code: string): Promise<CognitoResult> => confirmSignUp(email, code), []);
  const resend = useCallback((email: string): Promise<CognitoResult> => resendCode(email), []);

  const logIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const result = await signIn(email, password);
    if (result.kind !== "ok") return result;
    browserSession.save({
      idToken: result.tokens.idToken,
      refreshToken: result.tokens.refreshToken,
      expiresAt: Date.now() + result.tokens.expiresInSeconds * 1000,
    });
    setState({ kind: "loading" });
    setState(await resolveSignedIn());
    return result;
  }, []);

  const signOut = useCallback(() => {
    browserSession.clear();
    setState({ kind: "signed-out" });
  }, []);

  return { state, register, confirm, resend, logIn, signOut };
}
