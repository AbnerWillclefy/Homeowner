import type {
  Chore,
  ChoreWire,
  ClearResponsibleResult,
  Failure,
  RestrictedRefusal,
  SaveChoreResult,
  SetResponsibleResult,
} from "../api/api";
import type { FieldCodes } from "../../home/api/api";
import { guardOnce } from "../../../shared/ui/guardOnce";
import { toChoreInput, type ChoreFormState } from "./form";

export type ChoreFormStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "invalid"; fields: FieldCodes }
  /** The server will not make this Resident responsible (a lasting Restriction). The form keeps its values. */
  | RestrictedRefusal
  /** The Resident chosen is no longer in the Home. */
  | { kind: "unknown-resident" }
  | { kind: "failed"; reason: Failure["kind"] | "gone" };

/** How the form changes who is responsible. Absent where the form has no such field. */
export interface Responsibility {
  /** The Chore being edited as stored, or null when creating one. */
  existing: Chore | null;
  set(choreId: string, residentId: string): Promise<SetResponsibleResult>;
  clear(choreId: string): Promise<ClearResponsibleResult>;
  /** Saves the fields of a Chore that already exists: the retry after a create whose responsibility was refused. */
  update(choreId: string, input: ChoreWire): Promise<SaveChoreResult>;
}

interface Deps {
  /** Creates the Chore, or for an edit replaces it. */
  save(input: ChoreWire): Promise<SaveChoreResult>;
  /** Read at submit time, so the request carries what is typed now. */
  getValues(): ChoreFormState;
  onStatus(status: ChoreFormStatus): void;
  /** Gets the Chore with the responsible Resident actually saved, which the create or update response predates. */
  onSaved(chore: Chore, values: ChoreFormState): void;
  responsibility?: Responsibility;
  /** A Chore stored on the server although the form did not finish: the list must show it now. */
  onStored?(chore: Chore): void;
}

/**
 * The Chore form's submit as one function that ignores a second call while one is in flight (a double click
 * or a repeated Enter). A failure or a refusal re-arms it, so the retry sends again.
 *
 * Who is responsible is a separate call, ordered so neither step fails on the other's account. Creating: the
 * Chore first, then the Resident. Editing: the Resident first, then the fields, because the fields may add a
 * Demand the old Resident is restricted on. Only a changed value is sent, and a step that succeeded is not
 * repeated by a retry. A Chore that was created stays created, so a retry never posts a second one.
 */
export function createChoreSubmitter({ save, getValues, onStatus, onSaved, responsibility, onStored }: Deps) {
  const editing = responsibility?.existing != null;
  // What the server holds for the responsible Resident ("" is Nobody): what the form opened with, then each saved change.
  let confirmed = responsibility?.existing?.responsibleResidentId ?? "";
  // The Chore as the server has it, once it exists.
  let stored: Chore | null = responsibility?.existing ?? null;

  function refuse(result: Exclude<SaveChoreResult | SetResponsibleResult, { kind: "ok" }>) {
    if (result.kind === "invalid") onStatus({ kind: "invalid", fields: result.fields });
    else if (result.kind === "restricted" || result.kind === "unknown-resident") onStatus(result);
    else onStatus({ kind: "failed", reason: result.kind === "none" ? "gone" : result.kind });
  }

  /** Makes `target` ("" for Nobody) responsible for the stored Chore. False once it has said why not. */
  async function changeResponsible(chore: Chore, target: string): Promise<boolean> {
    const calls = responsibility!;
    const result = target === "" ? await calls.clear(chore.id) : await calls.set(chore.id, target);
    if (result.kind !== "ok") {
      refuse(result);
      return false;
    }
    confirmed = target;
    stored = { ...chore, responsibleResidentId: target || null };
    return true;
  }

  return guardOnce(async () => {
    const values = getValues();
    const input = toChoreInput(values);
    onStatus({ kind: "saving" });
    let changed = false;

    if (editing && values.responsible !== confirmed) {
      if (!(await changeResponsible(stored!, values.responsible))) return;
      changed = true;
    }

    const created = responsibility && !editing && stored !== null;
    const result = created ? await responsibility.update(stored!.id, input) : await save(input);
    if (result.kind !== "ok") {
      if (changed) onStored?.(stored!);
      return refuse(result);
    }
    // The response predates the responsibility call on a create, and an edit's carries the value just set.
    stored = responsibility ? { ...result.chore, responsibleResidentId: confirmed || null } : result.chore;

    if (!editing && responsibility && values.responsible !== confirmed) {
      if (!(await changeResponsible(stored, values.responsible))) {
        onStored?.(stored);
        return;
      }
    }

    onStatus({ kind: "idle" });
    onSaved(stored, values);
  });
}
