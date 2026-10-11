import type { MessageKey } from "../i18n";
import type { DayPlanState } from "./useDayPlan";

type Reason = Extract<DayPlanState, { kind: "failed" }>["reason"];

/** Shown when loading the Day Plan fails. A new failure kind fails the typecheck here until it has a message. */
export const LOAD_FAILURE_KEY: Record<Reason, MessageKey> = {
  offline: "dayplan.load.offline",
  error: "dayplan.load.error",
  // The section only exists with a Home, so a 404 means the Home went away: treat it as a failed load.
  none: "dayplan.load.error",
  "not-signed-in": "dayplan.notSignedIn",
};
