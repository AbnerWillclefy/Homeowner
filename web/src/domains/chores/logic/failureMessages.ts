import type { Failure, RestrictedRefusal } from "../api/api";
import type { MessageKey, Translate } from "../../../shared/i18n";

type Reason = Failure["kind"];

/** Shown when loading the Chores fails. A new failure kind fails the typecheck here until it has a message. */
export const LOAD_FAILURE_KEY: Record<Reason, MessageKey> = {
  offline: "chores.load.offline",
  error: "chores.load.error",
  "not-signed-in": "chores.notSignedIn",
};

/** Shown when saving a Chore fails. */
export const SAVE_FAILURE_KEY: Record<Reason | "gone", MessageKey> = {
  offline: "chores.form.save.offline",
  error: "chores.form.save.error",
  "not-signed-in": "chores.form.save.notSignedIn",
  gone: "chores.form.save.gone",
};

/** Shown when deleting a Chore fails. */
export const DELETE_FAILURE_KEY: Record<Reason, MessageKey> = {
  offline: "chores.delete.offline",
  error: "chores.delete.error",
  "not-signed-in": "chores.delete.notSignedIn",
};

/**
 * Why the server will not make a Resident responsible: the Demands they have a Restriction on, or the Chore itself.
 * It advises ("pick someone else") and names the Resident. A Restriction on the Chore wins over its Demands.
 */
export function restrictedMessage(
  t: Translate,
  name: string,
  refusal: Pick<RestrictedRefusal, "restrictedBy" | "restrictedByChore">,
  demandName: (id: string) => string,
): string {
  if (refusal.restrictedByChore || refusal.restrictedBy.length === 0) {
    return t("chores.form.responsible.restricted.chore", { name });
  }
  return t("chores.form.responsible.restricted.demands", { name, demands: refusal.restrictedBy.map(demandName).join(", ") });
}
