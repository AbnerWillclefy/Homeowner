export type AuthKind = "loading" | "signed-in" | "signed-out";

/**
 * When the query cache must be emptied: on a move to signed-out after the person had a session (signed in,
 * or loading after signing in). The first launch going loading to signed-out has nothing to forget, and
 * clearing would only drop a signed-out invite preview that may already be cached.
 */
export function nextCacheClear(hadSession: boolean, kind: AuthKind): { hadSession: boolean; clear: boolean } {
  if (kind === "signed-in") return { hadSession: true, clear: false };
  if (kind === "signed-out") return { hadSession: false, clear: hadSession };
  return { hadSession, clear: false };
}
