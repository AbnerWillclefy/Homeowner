import type { FailureReason, LeaveHomeResult } from "../api/home";

export type LeaveState =
  | { kind: "closed" }
  /** The confirmation is open. `failed` is why the last attempt did not go through. */
  | { kind: "confirming"; failed?: FailureReason }
  | { kind: "leaving" };

interface Options {
  leave(): Promise<LeaveHomeResult>;
  /** The Resident is out of the Home (or it was already gone). */
  onLeft(): void;
}

/**
 * The steps of leaving a Home: ask, confirm, send. Nothing is sent until `confirm`, and only one request is
 * in flight at a time. Plain TypeScript so it is tested without a browser; `useLeaveHome` wires it to React.
 */
export function createLeaveFlow({ leave, onLeft }: Options) {
  let state: LeaveState = { kind: "closed" };
  const listeners = new Set<() => void>();

  function set(next: LeaveState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  return {
    state: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    open() {
      if (state.kind === "closed") set({ kind: "confirming" });
    },
    cancel() {
      if (state.kind === "confirming") set({ kind: "closed" });
    },
    async confirm() {
      if (state.kind !== "confirming") return;
      set({ kind: "leaving" });
      const result = await leave();
      // A Home that is already gone (none) is the outcome the Resident asked for.
      if (result.kind === "ok" || result.kind === "none") {
        set({ kind: "closed" });
        onLeft();
      } else {
        set({ kind: "confirming", failed: result.kind });
      }
    },
  };
}

export type LeaveFlow = ReturnType<typeof createLeaveFlow>;
