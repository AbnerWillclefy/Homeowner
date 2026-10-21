import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../domains/auth/hooks/useAuth";
import { nextCacheClear } from "../logic/cacheClear";

type Auth = ReturnType<typeof useAuth>;

interface AuthValue extends Auth {
  /** The person chose to sign out, so the sign-in screen must not remember where they were. */
  signedOutOnPurpose: boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

/** One auth state for the whole app, shared by the guard, the auth screens and the Me tab. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [signedOutOnPurpose, setOnPurpose] = useState(false);
  const { signOut: rawSignOut } = auth;
  const signOut = useCallback(() => {
    setOnPurpose(true);
    rawSignOut();
    queryClient.clear();
  }, [rawSignOut, queryClient]);

  // Nothing a Resident saw may show to the next person on this phone. This also catches a sign-out the API
  // client forces after a surviving 401, which only clears the session.
  const hadSession = useRef(false);
  useEffect(() => {
    const step = nextCacheClear(hadSession.current, auth.state.kind);
    hadSession.current = step.hadSession;
    if (step.clear) queryClient.clear();
  }, [auth.state.kind, queryClient]);

  // A later session expiry is not on purpose.
  useEffect(() => {
    if (auth.state.kind === "signed-in") setOnPurpose(false);
  }, [auth.state.kind]);

  const value = useMemo(() => ({ ...auth, signOut, signedOutOnPurpose }), [auth, signOut, signedOutOnPurpose]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAppAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("useAppAuth needs AuthProvider");
  return value;
}
