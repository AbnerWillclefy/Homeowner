import type { FailureReason, Home, HomeSettings } from "../api/home";
import type { ChoreWire } from "../api/chores";
import { splitSaveErrors, toWire, type ReviewItem, type SplitErrors } from "../catalog/review";
import { guardOnce } from "../shared/ui/guardOnce";
import type { CreateOutcome } from "./createOrLoad";

export type CreateStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "failed"; reason: FailureReason };

interface Deps {
  create(settings: HomeSettings, chores: ChoreWire[]): Promise<CreateOutcome>;
  /** Read at submit time, so the request carries what is on screen now. */
  getSettings(): HomeSettings;
  getItems(): readonly ReviewItem[];
  onStatus(status: CreateStatus): void;
  /** The API refused some fields; `split` says which belong to the Home and which to each reviewed Chore. */
  onInvalid(split: SplitErrors): void;
  onSaved(home: Home): void;
  /** The person already had a Home. `choresDropped` is true when reviewed Chores were not added to it. */
  onRecovered(home: Home, choresDropped: boolean): void;
}

/**
 * The last step of creating a Home as one function that ignores a second call while one is in flight (a double
 * click on the button). A failure or a refusal re-arms it, so the retry sends again.
 */
export function createHomeSubmitter({ create, getSettings, getItems, onStatus, onInvalid, onSaved, onRecovered }: Deps) {
  return guardOnce(async () => {
    const items = getItems();
    onStatus({ kind: "saving" });
    const outcome = await create(getSettings(), toWire(items));
    if (outcome.kind === "ok") return onSaved(outcome.home);
    if (outcome.kind === "recovered") return onRecovered(outcome.home, items.length > 0);
    if (outcome.kind === "invalid") {
      onStatus({ kind: "idle" });
      return onInvalid(splitSaveErrors(outcome.fields, items));
    }
    onStatus({ kind: "failed", reason: outcome.kind });
  });
}
