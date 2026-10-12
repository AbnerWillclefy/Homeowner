import { useMemo, useState, type FormEvent } from "react";
import type { Chore, ChoreWire, SaveChoreResult } from "./api";
import type { FieldCodes } from "../home/api";
import { useStableHandlers } from "../shared/ui/useStableHandlers";
import { createChoreSubmitter, type ChoreFormStatus } from "./choreSubmit";
import type { ChoreFormState } from "./form";

export type { ChoreFormStatus } from "./choreSubmit";

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
) {
  const [values, setValues] = useState<ChoreFormState>(initial);
  const [status, setStatus] = useState<ChoreFormStatus>(() =>
    Object.keys(initialErrors).length > 0 ? { kind: "invalid", fields: initialErrors } : { kind: "idle" },
  );

  /** Changes some fields; `fields` names the API fields whose errors the change answers. */
  function change(patch: Partial<ChoreFormState>, ...fields: string[]) {
    setValues((current) => ({ ...current, ...patch }));
    setStatus((current) => {
      if (current.kind !== "invalid") return current;
      const rest = Object.fromEntries(Object.entries(current.fields).filter(([field]) => !fields.includes(field)));
      return Object.keys(rest).length > 0 ? { kind: "invalid", fields: rest } : { kind: "idle" };
    });
  }

  // The guard lives in the submitter, so a second Enter in the same tick is ignored, not only a disabled button.
  const stable = useStableHandlers({ save, onSaved, getValues: () => values });
  const submitter = useMemo(() => createChoreSubmitter({ ...stable, onStatus: setStatus }), [stable]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void submitter();
  }

  return { values, status, change, submit };
}
