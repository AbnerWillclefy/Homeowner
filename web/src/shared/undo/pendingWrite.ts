/** What the screen's own send answers with. A 409 is its own kind so the shared code words it once. */
export type SendResult =
  | { kind: "ok" }
  | { kind: "conflict"; messageKey: string }
  | { kind: "failed"; messageKey: string };

/** The part of a held action the reducer needs. The provider's actions carry more (see `UndoProvider`). */
export interface Writable {
  id: number;
}

/**
 * At most one action is `held` (shown as done, request not sent). Sent ones are `sending` until the server
 * answers; the screen keeps showing them as done until then, so a failed send can still restore.
 * Restoring is leaving both lists: the cache always holds the server's truth (ADR 0029).
 */
export interface PendingState<A extends Writable> {
  held: A | null;
  sending: readonly A[];
}

export type PendingEvent<A extends Writable> =
  | { type: "start"; action: A }
  | { type: "undo"; id: number }
  | { type: "close"; id: number }
  /** A change undone by writing the old value back starts: it takes the one Toast, so the hold is sent. */
  | { type: "another" }
  | { type: "navigate" }
  | { type: "hidden" }
  | { type: "signOut" }
  | { type: "sent"; id: number }
  | { type: "failed"; id: number; result: Exclude<SendResult, { kind: "ok" }> };

export type PendingEffect<A extends Writable> =
  | { type: "send"; action: A; keepalive: boolean }
  | { type: "report"; action: A; result: Exclude<SendResult, { kind: "ok" }> };

export function idle<A extends Writable>(): PendingState<A> {
  return { held: null, sending: [] };
}

/** Sends the held action, if any. */
function flush<A extends Writable>(state: PendingState<A>, keepalive: boolean) {
  if (!state.held) return { state, effects: [] };
  const { held } = state;
  return {
    state: { held: null, sending: [...state.sending, held] },
    effects: [{ type: "send", action: held, keepalive } satisfies PendingEffect<A>],
  };
}

/**
 * The hold of ADR 0029 as a pure state machine: the next state and the side effects to run. An event naming an
 * id that is not the held one is a no-op; this is what makes Radix's `close` after Desfazer's click harmless.
 */
export function pendingWrite<A extends Writable>(
  state: PendingState<A>,
  event: PendingEvent<A>,
): { state: PendingState<A>; effects: PendingEffect<A>[] } {
  switch (event.type) {
    case "start": {
      const sent = flush(state, false);
      return { state: { ...sent.state, held: event.action }, effects: sent.effects };
    }
    case "undo":
      return state.held?.id === event.id ? { state: { ...state, held: null }, effects: [] } : { state, effects: [] };
    case "close":
      return state.held?.id === event.id ? flush(state, false) : { state, effects: [] };
    case "another":
    case "navigate":
    case "signOut":
      return flush(state, false);
    case "hidden":
      return flush(state, true);
    case "sent":
      return { state: { ...state, sending: state.sending.filter((a) => a.id !== event.id) }, effects: [] };
    case "failed": {
      const action = state.sending.find((a) => a.id === event.id);
      if (!action) return { state, effects: [] };
      return {
        state: { ...state, sending: state.sending.filter((a) => a.id !== event.id) },
        effects: [{ type: "report", action, result: event.result }],
      };
    }
  }
}
