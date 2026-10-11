import { useState, type FormEvent } from "react";
import type { FieldCodes, Home, HomeSettings } from "../api/home";
import type { SaveOutcome } from "./createOrLoad";

export type FormStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "invalid"; fields: FieldCodes }
  | { kind: "failed"; reason: "offline" | "error" | "not-signed-in" };

/**
 * The state of a Home settings form, shared by create and edit. The typed values live here and are
 * never reset by a failure, so a retry sends exactly what the person typed.
 */
export function useSettingsForm(
  initial: HomeSettings,
  save: (settings: HomeSettings) => Promise<SaveOutcome>,
  onSaved: (home: Home, recovered: boolean) => void,
) {
  const [values, setValues] = useState<HomeSettings>(initial);
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  function change(field: keyof HomeSettings, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setStatus((current) => {
      if (current.kind === "saved") return { kind: "idle" };
      if (current.kind !== "invalid") return current;
      // Editing a field clears its own error; the others stay until the next try.
      const { [field]: _fixed, ...rest } = current.fields;
      return Object.keys(rest).length > 0 ? { kind: "invalid", fields: rest } : { kind: "idle" };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status.kind === "saving") return;
    setStatus({ kind: "saving" });
    const outcome = await save(values);
    if (outcome.kind === "ok") {
      setStatus({ kind: "saved" });
      onSaved(outcome.home, outcome.recovered);
    } else if (outcome.kind === "invalid") {
      setStatus({ kind: "invalid", fields: outcome.fields });
    } else {
      setStatus({ kind: "failed", reason: outcome.kind });
    }
  }

  return { values, status, change, submit };
}
