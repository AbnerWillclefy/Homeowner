import type { AcceptInviteResult } from "../api/invites";
import { guardOnce } from "../shared/ui/guardOnce";
import type { JoinOutcome, JoinState } from "./useJoinInvite";

interface Deps {
  accept(confirmLeave: boolean): Promise<AcceptInviteResult>;
  onState(state: JoinState): void;
  onFinished(outcome: JoinOutcome): void;
}

/**
 * Joining a Home as one function that ignores a second call while one is in flight (a double tap on Join, or on
 * the leave confirmation). Every outcome except a finished join re-arms it, so a retry sends again.
 */
export function createJoiner({ accept, onState, onFinished }: Deps) {
  return guardOnce(async (confirmLeave: boolean) => {
    onState({ kind: "joining" });
    const result = await accept(confirmLeave);
    switch (result.kind) {
      case "ok":
        return onFinished("joined");
      case "already-here":
        return onFinished("already-here");
      case "would-leave":
        return onState({ kind: "warn" });
      case "not-found":
      case "used":
      case "expired":
        return onState({ kind: "dead", why: result.kind });
      default:
        return onState(confirmLeave ? { kind: "warn", error: result.kind } : { kind: "ready", error: result.kind });
    }
  });
}
