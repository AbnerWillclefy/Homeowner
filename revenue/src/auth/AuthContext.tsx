import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { signIn as cognitoSignIn, type CognitoFailure } from "./cognito";
import { browserSession, type SessionStore } from "./session";

export interface Auth {
  signedIn: boolean;
  /** Resolves to null on success, or why it failed. */
  signIn(email: string, password: string): Promise<CognitoFailure | null>;
  /** Clears the tokens and the query cache; the app then shows the sign-in screen. */
  signOut(): void;
}

export const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (auth === null) throw new Error("useAuth needs an AuthProvider");
  return auth;
}

export function AuthProvider({ children, session = browserSession }: { children: ReactNode; session?: SessionStore }) {
  const queryClient = useQueryClient();
  const current = useSyncExternalStore(session.subscribe, session.load);
  // The session also ends from inside the API client (a refused refresh); the cache must not outlive it.
  useEffect(() => {
    if (current === null) queryClient.clear();
  }, [current, queryClient]);
  const signedIn = current !== null;
  // Keyed on signedIn, not the session object: a token refresh must not re-render every useAuth consumer.
  const value = useMemo<Auth>(
    () => ({
      signedIn,
      async signIn(email, password) {
        const result = await cognitoSignIn(email, password);
        if (result.kind !== "ok") return result;
        if (result.tokens.refreshToken === undefined) return { kind: "error" };
        session.save({
          idToken: result.tokens.idToken,
          refreshToken: result.tokens.refreshToken,
          expiresAt: Date.now() + result.tokens.expiresInSeconds * 1000,
        });
        return null;
      },
      signOut() {
        session.clear();
      },
    }),
    [signedIn, session],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}
