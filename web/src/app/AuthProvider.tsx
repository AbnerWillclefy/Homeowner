import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/useAuth";

type Auth = ReturnType<typeof useAuth>;

interface AuthValue extends Auth {
  /** The person chose to sign out, so the sign-in screen must not remember where they were. */
  signedOutOnPurpose: boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

/** One auth state for the whole app, shared by the guard, the auth screens and the Me tab. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [signedOutOnPurpose, setOnPurpose] = useState(false);
  const { signOut: rawSignOut } = auth;
  const signOut = useCallback(() => {
    setOnPurpose(true);
    rawSignOut();
  }, [rawSignOut]);

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
