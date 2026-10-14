import type { WriteResult } from "../api/api";

export interface Change {
  /** Names the control (for example `baseline:monday`), so only a repeat on the same control is ignored. */
  key: string;
  /** Shows the change at once. */
  apply(): void;
  /** Puts back only the field the change touched. */
  revert(): void;
  send(): Promise<WriteResult>;
  onSaved(): void;
  onFailed(problem: Exclude<WriteResult["kind"], "ok">): void;
}

/**
 * Shows a change, sends it, and undoes it if the write fails. A change to a control that already has one in
 * flight is ignored, so rapid taps send one request; other controls are not held up. `inFlight` is a plain set
 * (not React state) so a second tap in the same tick sees the first.
 */
export async function performChange(inFlight: Set<string>, change: Change): Promise<void> {
  if (inFlight.has(change.key)) return;
  inFlight.add(change.key);
  try {
    change.apply();
    let result: WriteResult;
    try {
      result = await change.send();
    } catch {
      result = { kind: "error" };
    }
    if (result.kind === "ok") return change.onSaved();
    change.revert();
    change.onFailed(result.kind);
  } finally {
    inFlight.delete(change.key);
  }
}
