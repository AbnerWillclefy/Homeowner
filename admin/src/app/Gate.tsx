import { useEffect, type ReactNode } from "react";
import { useAdminMe } from "../api/adminMe";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../shared/Button";

/**
 * Renders its children only when `GET /admin/me` answers 200. This gate is a convenience: it saves a
 * non-admin from a screen full of failing requests. The server's 403 on every `/admin/` route is the control.
 * Until the answer is 200, no child is mounted, so no other query fires.
 */
export function Gate({ children }: { children: ReactNode }) {
  const me = useAdminMe();
  const { signOut } = useAuth();
  const unauthorized = me.data?.kind === "unauthorized";

  // A 401 means the session is no good: end it, and the app shows sign-in.
  useEffect(() => {
    if (unauthorized) signOut();
  }, [unauthorized, signOut]);

  if (me.isPending) return <p role="status" className="p-6 text-sm text-muted">Checking your access…</p>;

  if (me.isError) {
    return (
      <section className="mx-auto my-12 w-full max-w-sm rounded-card border border-border/50 bg-surface-raised p-6">
        <h1>Could not reach the API</h1>
        <p role="alert" className="text-sm">Check your connection, then try again.</p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => void me.refetch()} disabled={me.isFetching}>
            Try again
          </Button>
          <Button variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </section>
    );
  }

  switch (me.data.kind) {
    case "forbidden":
      return (
        <section className="mx-auto my-12 w-full max-w-sm rounded-card border border-border/50 bg-surface-raised p-6">
          <h1>This account is not allowed here</h1>
          <p className="text-sm">The admin app is for the maintainer only. Sign out and use another account.</p>
          <Button className="mt-6" onClick={signOut}>
            Sign out
          </Button>
        </section>
      );
    case "unauthorized":
      return null;
    case "ok":
      return <>{children}</>;
  }
}
