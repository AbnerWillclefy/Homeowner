import type { DeadInvite } from "./api";
import type { MessageKey } from "../shared/i18n";

/** What to tell a person whose Invite cannot be used. A new DeadInvite fails the typecheck until it has text. */
export const DEAD_INVITE_KEY: Record<DeadInvite, MessageKey> = {
  "not-found": "invite.dead.not_found",
  used: "invite.dead.used",
  expired: "invite.dead.expired",
};

export function isDeadInvite<T extends { kind: string }>(result: T): result is Extract<T, { kind: DeadInvite }> {
  return Object.hasOwn(DEAD_INVITE_KEY, result.kind);
}
