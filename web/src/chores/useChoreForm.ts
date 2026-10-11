import { useState, type FormEvent } from "react";
import type { Chore, ChoreWire, Failure, SaveChoreResult } from "../api/chores";
import type { FieldCodes } from "../api/home";
import { emptyForm, formFromChore, toChoreInput, type ChoreFormState } from "./form";

export type ChoreFormStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "invalid"; fields: FieldCodes }
  | { kind: "failed"; reason: Failure["kind"] | "gone" };

/**
 * The state of the Chore form. The typed values live here and a failure never resets them, so a retry
 * sends exactly what was typed. An API field error clears when its field is edited.
 */
export function useChoreForm(
  chore: Chore | null,
  save: (input: ChoreWire) => Promise<SaveChoreResult>,
  onSaved: (chore: Chore) => void,
) {
  const [values, setValues] = useState<ChoreFormState>(() => (chore ? formFromChore(chore) : emptyForm()));
  const [status, setStatus] = useState<ChoreFormStatus>({ kind: "idle" });

  /** Changes some fields; `fields` names the API fields whose errors the change answers. */
  function change(patch: Partial<ChoreFormState>, ...fields: string[]) {
    setValues((current) => ({ ...current, ...patch }));
    setStatus((current) => {
      if (current.kind !== "invalid") return current;
      const rest = Object.fromEntries(Object.entries(current.fields).filter(([field]) => !fields.includes(field)));
      return Object.keys(rest).length > 0 ? { kind: "invalid", fields: rest } : { kind: "idle" };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status.kind === "saving") return;
    setStatus({ kind: "saving" });
    const result = await save(toChoreInput(values));
    if (result.kind === "ok") onSaved(result.chore);
    else if (result.kind === "invalid") setStatus({ kind: "invalid", fields: result.fields });
    else setStatus({ kind: "failed", reason: result.kind === "none" ? "gone" : result.kind });
  }

  return { values, status, change, submit };
}
