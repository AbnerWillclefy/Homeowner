import { useCallback, useEffect, useMemo, useState } from "react";
import { useStableHandlers } from "../shared/ui/useStableHandlers";
import { acceptInvite, type DeadInvite } from "../api/invites";
import { getHome, type FailureReason } from "../api/home";
import { createJoiner } from "./joinSubmit";

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

  // The guard lives in the joiner, so a second tap in the same tick is ignored, not only a disabled button.
  const stable = useStableHandlers({
    accept: (confirmLeave: boolean) => acceptInvite(token, confirmLeave),
    onFinished,
  });
  const join = useMemo(() => createJoiner({ ...stable, onState: setState }), [stable]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, join, reload };
}
