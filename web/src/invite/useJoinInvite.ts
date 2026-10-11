import { useCallback, useEffect, useState } from "react";
import { acceptInvite, type DeadInvite } from "../api/invites";
import { getHome, type FailureReason } from "../api/home";

export type JoinState =
  | { kind: "loading" }
  /** The person's Home could not be loaded, so it is not known whether joining means leaving. */
  | { kind: "load-failed"; reason: FailureReason }
  /** The person has no Home: joining is one tap. `error` is set when the last try failed; the Invite is kept. */
  | { kind: "ready"; error?: FailureReason }
  /** The person lives in a Home: joining means leaving it, and they must say so. */
  | { kind: "warn"; error?: FailureReason }
  | { kind: "joining" }
  | { kind: "dead"; why: DeadInvite };

export type JoinOutcome = "joined" | "already-here";

/**
 * The signed-in side of an Invite. Asks for the person's Home first, so the leave warning is shown before
 * anything is sent; the API still has the last word and answers 409 if the person's situation changed.
 * `onFinished` is called once the Invite is spent or pointless, so the caller can forget it.
 */
export function useJoinInvite(token: string, onFinished: (outcome: JoinOutcome) => void) {
  const [state, setState] = useState<JoinState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    void getHome().then((result) => {
      if (cancelled) return;
      if (result.kind === "ok") setState({ kind: "warn" });
      else if (result.kind === "none") setState({ kind: "ready" });
      else setState({ kind: "load-failed", reason: result.kind });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const join = useCallback(
    async (confirmLeave: boolean) => {
      setState({ kind: "joining" });
      const result = await acceptInvite(token, confirmLeave);
      switch (result.kind) {
        case "ok":
          return onFinished("joined");
        case "already-here":
          return onFinished("already-here");
        case "would-leave":
          return setState({ kind: "warn" });
        case "not-found":
        case "used":
        case "expired":
          return setState({ kind: "dead", why: result.kind });
        default:
          return setState(confirmLeave ? { kind: "warn", error: result.kind } : { kind: "ready", error: result.kind });
      }
    },
    [token, onFinished],
  );

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, join, reload };
}
