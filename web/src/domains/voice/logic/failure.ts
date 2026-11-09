import type { MessageKey } from "../../../shared/i18n";
import { ACTION_FAILURE_KEY, conflictMessageKey } from "../../dayplan/logic/failureMessages";
import type { VoiceAction } from "../api/api";

const CHORE_FAILURE_KEY: Record<string, MessageKey> = {
  offline: "chores.form.save.offline",
  "not-signed-in": "chores.form.save.notSignedIn",
  // The Chore was deleted between interpret and Confirm.
  none: "chores.form.save.gone",
  // The server already validated the proposal, so this is rare; the field is not known here.
  invalid: "chores.field.unknown",
};

/** Why one action failed, from the raw reason `sendAction` records ("conflict:<code>", "none", "offline"...), in the app's existing words. */
export function failureKey(action: VoiceAction, reason: string): MessageKey {
  if (action.kind === "create_chore" || action.kind === "edit_chore") return CHORE_FAILURE_KEY[reason] ?? "chores.form.save.error";
  if (reason.startsWith("conflict:")) return conflictMessageKey(reason.slice("conflict:".length));
  return Object.hasOwn(ACTION_FAILURE_KEY, reason) ? ACTION_FAILURE_KEY[reason as keyof typeof ACTION_FAILURE_KEY] : "dayplan.action.failed.error";
}
