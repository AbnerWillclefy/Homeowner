import { useMemo, useState, type FormEvent } from "react";
import type { Chore, ChoreWire, SaveChoreResult } from "../api/api";
import type { FieldCodes } from "../../home/api/api";
import { useStableHandlers } from "../../../shared/ui/useStableHandlers";
import { createChoreSubmitter, type ChoreFormStatus, type Responsibility } from "../logic/choreSubmit";
import type { ChoreFormState } from "../logic/form";

export type { ChoreFormStatus } from "../logic/choreSubmit";

/**
 * The state of the Chore form. The typed values live here and a failure never resets them, so a retry
 * sends exactly what was typed. An API field error clears when its field is edited.
 */
export function useChoreForm(
  initial: ChoreFormState,
  save: (input: ChoreWire) => Promise<SaveChoreResult>,
  onSaved: (chore: Chore, values: ChoreFormState) => void,
  /** Errors to show from the start, for a form opened to fix what the API refused. */
  initialErrors: FieldCodes = {},
  /** Present where the form has the Responsible field. */
  responsibility?: Responsibility,
  // Keep `responsibility` the same object between renders: the submitter holds what it has saved.
  /** Gets a Chore that is stored although the form did not finish, so the list can show it. */
  onStored?: (chore: Chore) => void,
) {
  const [values, setValues] = useState<ChoreFormState>(initial);
  const [status, setStatus] = useState<ChoreFormStatus>(() =>
    Object.keys(initialErrors).length > 0 ? { kind: "invalid", fields: initialErrors } : { kind: "idle" },
  );

  /** Changes some fields; `fields` names the API fields whose errors the change answers. */
  function change(patch: Partial<ChoreFormState>, ...fields: string[]) {
    setValues((current) => ({ ...current, ...patch }));
    setStatus((current) => {
      // Editing the Responsible field undoes the choice a refusal described.
      if (fields.includes("responsible") && (current.kind === "restricted" || current.kind === "unknown-resident")) return { kind: "idle" };
      if (current.kind !== "invalid") return current;
      const rest = Object.fromEntries(Object.entries(current.fields).filter(([field]) => !fields.includes(field)));
      return Object.keys(rest).length > 0 ? { kind: "invalid", fields: rest } : { kind: "idle" };
    });
  }

  // The guard lives in the submitter, so a second Enter in the same tick is ignored, not only a disabled button.
  const stable = useStableHandlers({ save, onSaved, onStored: onStored ?? (() => {}), getValues: () => values });
  const submitter = useMemo(() => createChoreSubmitter({ ...stable, responsibility, onStatus: setStatus }), [stable, responsibility]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void submitter();
  }

  return { values, status, change, submit };
}
