import type { Chore, ChoreWire, Failure, SaveChoreResult } from "./api";
import type { FieldCodes } from "../home/api";
import { guardOnce } from "../shared/ui/guardOnce";
import { toChoreInput, type ChoreFormState } from "./form";

export type ChoreFormStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "invalid"; fields: FieldCodes }
  | { kind: "failed"; reason: Failure["kind"] | "gone" };

interface Deps {
  save(input: ChoreWire): Promise<SaveChoreResult>;
  /** Read at submit time, so the request carries what is typed now. */
  getValues(): ChoreFormState;
  onStatus(status: ChoreFormStatus): void;
  onSaved(chore: Chore, values: ChoreFormState): void;
}

/**
 * The Chore form's submit as one function that ignores a second call while one is in flight (a double click
 * or a repeated Enter). A failure or a refusal re-arms it, so the retry sends again.
 */
export function createChoreSubmitter({ save, getValues, onStatus, onSaved }: Deps) {
  return guardOnce(async () => {
    const values = getValues();
    onStatus({ kind: "saving" });
    const result = await save(toChoreInput(values));
    if (result.kind === "ok") {
      onStatus({ kind: "idle" });
      onSaved(result.chore, values);
    } else if (result.kind === "invalid") {
      onStatus({ kind: "invalid", fields: result.fields });
    } else {
      onStatus({ kind: "failed", reason: result.kind === "none" ? "gone" : result.kind });
    }
  });
}
