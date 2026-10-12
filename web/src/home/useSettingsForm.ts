import { useMemo, useState, type FormEvent } from "react";
import type { Home, HomeSettings } from "../api/home";
import { useStableHandlers } from "../shared/ui/useStableHandlers";
import { createSettingsSubmitter, type FormStatus, type SaveOutcome } from "./settingsSubmit";

export type { FormStatus, SaveOutcome } from "./settingsSubmit";

/**
 * The state of a Home settings form, shared by create and edit. The typed values live here and are
 * never reset by a failure, so a retry sends exactly what the person typed.
 */
export function useSettingsForm(
  initial: HomeSettings,
  save: (settings: HomeSettings) => Promise<SaveOutcome>,
  onSaved: (home: Home) => void,
  /** Only a create can be recovered; an edit never passes this. */
  onRecovered: (home: Home) => void = onSaved,
) {
  const [values, setValues] = useState<HomeSettings>(initial);
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  function change(field: keyof HomeSettings, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setStatus((current) => {
      if (current.kind !== "invalid") return current;
      // Editing a field clears its own error; the others stay until the next try.
      const { [field]: _fixed, ...rest } = current.fields;
      return Object.keys(rest).length > 0 ? { kind: "invalid", fields: rest } : { kind: "idle" };
    });
  }

  // The guard lives in the submitter, so a second Enter in the same tick is ignored, not only a disabled button.
  const stable = useStableHandlers({ save, onSaved, onRecovered, getValues: () => values });
  const submitter = useMemo(() => createSettingsSubmitter({ ...stable, onStatus: setStatus }), [stable]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void submitter();
  }

  return { values, status, change, submit };
}
