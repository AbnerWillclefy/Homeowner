import type { MessageKey } from "../i18n";
import type { CheckInState, SaveFailure } from "./state";

type LoadReason = Extract<CheckInState, { kind: "failed" }>["reason"];

/** Shown when loading the Check-in fails. A new failure kind fails the typecheck here until it has a message. */
export const LOAD_FAILURE_KEY: Record<LoadReason, MessageKey> = {
  offline: "checkin.load.offline",
  error: "checkin.load.error",
  // The section only exists with a Home, so a 404 means the Home went away: treat it as a failed load.
  none: "checkin.load.error",
  "not-signed-in": "checkin.notSignedIn",
};

/** Shown when saving the Check-in fails. */
export const SAVE_FAILURE_KEY: Record<SaveFailure, MessageKey> = {
  offline: "checkin.save.offline",
  error: "checkin.save.error",
  none: "checkin.save.error",
  invalid: "checkin.save.invalid",
  "not-signed-in": "checkin.notSignedIn",
};
