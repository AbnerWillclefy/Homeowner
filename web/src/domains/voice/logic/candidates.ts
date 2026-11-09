import type { VoiceAction } from "../api/api";

/** The action a pick turns a choice into: the candidate itself. Anything else, or an index out of range, is unchanged. */
export function pick(action: VoiceAction, index: number): VoiceAction {
  return action.kind === "choice" ? (action.candidates[index] ?? action) : action;
}

/** Confirm needs something to send and no action still waiting for a pick; removing a choice unblocks it too. */
export const canConfirm = (actions: VoiceAction[]): boolean => actions.length > 0 && actions.every((a) => a.kind !== "choice");

/** At or under this many left, the panel says how many are left. */
export const FEW_LEFT = 3;
