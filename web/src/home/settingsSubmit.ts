import type { FailureReason, FieldCodes, Home, HomeSettings } from "../api/home";
import { guardOnce } from "../components/ui/guardOnce";

/** What a save can come back with. `recovered` is a create that found the person's existing Home and loaded it. */
export type SaveOutcome =
  | { kind: "ok" | "recovered"; home: Home }
  | { kind: "invalid"; fields: FieldCodes }
  | { kind: FailureReason };

export type FormStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "invalid"; fields: FieldCodes }
  | { kind: "failed"; reason: FailureReason };

interface Deps {
  save(settings: HomeSettings): Promise<SaveOutcome>;
  /** Read at submit time, so the request carries what is typed now. */
  getValues(): HomeSettings;
  onStatus(status: FormStatus): void;
  onSaved(home: Home): void;
  /** Only a create can be recovered; an edit never passes this. */
  onRecovered?(home: Home): void;
}

/**
 * The Home settings form's submit as one function that ignores a second call while one is in flight (a double
 * click or a repeated Enter). A failure or a refusal re-arms it, so the retry sends again.
 */
export function createSettingsSubmitter({ save, getValues, onStatus, onSaved, onRecovered = onSaved }: Deps) {
  return guardOnce(async () => {
    onStatus({ kind: "saving" });
    const outcome = await save(getValues());
    if (outcome.kind === "ok" || outcome.kind === "recovered") {
      onStatus({ kind: "idle" });
      (outcome.kind === "ok" ? onSaved : onRecovered)(outcome.home);
    } else if (outcome.kind === "invalid") {
      onStatus({ kind: "invalid", fields: outcome.fields });
    } else {
      onStatus({ kind: "failed", reason: outcome.kind });
    }
  });
}
