import type { FailureReason } from "../api/api";
import type { MessageKey } from "../../../shared/i18n";

/** Shown when loading the Home fails. A new FailureReason fails the typecheck here until it has a message. */
export const LOAD_FAILURE_KEY: Record<FailureReason, MessageKey> = {
  offline: "home.load.offline",
  error: "home.load.error",
  "not-signed-in": "home.notSignedIn",
};

/** Shown when leaving the Home fails. */
export const LEAVE_FAILURE_KEY: Record<FailureReason, MessageKey> = {
  offline: "home.leave.offline",
  error: "home.leave.error",
  "not-signed-in": "home.notSignedIn",
};

/** Shown when saving the Home fails. */
export const SAVE_FAILURE_KEY: Record<FailureReason, MessageKey> = {
  offline: "home.save.offline",
  error: "home.save.error",
  "not-signed-in": "home.notSignedIn",
};
