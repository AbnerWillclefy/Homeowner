import type { FailureReason } from "./api";

export type LeaveState =
  | { kind: "closed" }
  /** The confirmation is open. `failed` is why the last attempt did not go through. */
  | { kind: "confirming"; failed?: FailureReason }
  | { kind: "leaving" };

export type LeaveAction =
  | { type: "open" }
  | { type: "cancel" }
  | { type: "confirm" }
  | { type: "failed"; reason: FailureReason }
  | { type: "done" };

/**
 * The steps of leaving a Home: ask, confirm, send. A Resident cannot cancel while the request is in flight,
 * and only an open confirmation can be confirmed. Plain TypeScript so it is tested without a browser.
 */
export function leaveReducer(state: LeaveState, action: LeaveAction): LeaveState {
  switch (action.type) {
    case "open":
      return state.kind === "closed" ? { kind: "confirming" } : state;
    case "cancel":
      return state.kind === "confirming" ? { kind: "closed" } : state;
    case "confirm":
      return state.kind === "confirming" ? { kind: "leaving" } : state;
    case "failed":
      return state.kind === "leaving" ? { kind: "confirming", failed: action.reason } : state;
    case "done":
      return state.kind === "leaving" ? { kind: "closed" } : state;
  }
}
