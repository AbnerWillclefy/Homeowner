import type { MessageKey } from "../../../shared/i18n";
import type { DayPlanState } from "../hooks/useDayPlan";

type Reason = Extract<DayPlanState, { kind: "failed" }>["reason"];

/** Shown when loading the Day Plan fails. A new failure kind fails the typecheck here until it has a message. */
export const LOAD_FAILURE_KEY: Record<Reason, MessageKey> = {
  offline: "dayplan.load.offline",
  error: "dayplan.load.error",
  // The section only exists with a Home, so a 404 means the Home went away: treat it as a failed load.
  none: "dayplan.load.error",
  "not-signed-in": "dayplan.notSignedIn",
};

/** Shown when an action did not reach the server or was not understood. The plan on screen is still valid. */
export const ACTION_FAILURE_KEY = {
  offline: "dayplan.action.failed.offline",
  error: "dayplan.action.failed.error",
  // The Task is gone (404): the same advice as any other stale screen.
  none: "dayplan.action.failed.error",
  "not-signed-in": "dayplan.notSignedIn",
} as const satisfies Record<"offline" | "error" | "none" | "not-signed-in", MessageKey>;

// The 409 codes the API sends (backend/internal/server/commit.go). A new one fails the typecheck until it has a message.
const CONFLICT_KEYS = {
  no_plan_today: "dayplan.conflict.no_plan_today",
  not_proposed: "dayplan.conflict.not_proposed",
  already_committed: "dayplan.conflict.already_committed",
  not_in_pool: "dayplan.conflict.not_in_pool",
  not_yours: "dayplan.conflict.not_yours",
  already_done: "dayplan.conflict.already_done",
  two_person_task: "dayplan.conflict.two_person_task",
  restricted: "dayplan.conflict.restricted",
  drained: "dayplan.conflict.drained",
} as const satisfies Record<string, MessageKey>;

/** What to tell the Resident after a 409. A code the app does not know gets a generic "the plan changed". */
export function conflictMessageKey(code: string): MessageKey {
  return Object.hasOwn(CONFLICT_KEYS, code)
    ? CONFLICT_KEYS[code as keyof typeof CONFLICT_KEYS]
    : "dayplan.conflict.unknown";
}
