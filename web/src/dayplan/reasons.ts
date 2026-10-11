import type { MessageKey } from "../i18n";
import type { Label } from "../profile/labels";

// The reason ids the Allocation sends. A key that is not in the catalogs fails the typecheck.
const POOL_REASON_KEYS = {
  no_energy_left: "dayplan.pool.reason.no_energy_left",
  restricted_for_all: "dayplan.pool.reason.restricted_for_all",
  weekday_not_allowed: "dayplan.pool.reason.weekday_not_allowed",
  two_person_deferred: "dayplan.pool.reason.two_person_deferred",
  invalid_effort: "dayplan.pool.reason.invalid_effort",
  added_after_plan: "dayplan.pool.reason.added_after_plan",
} as const satisfies Record<string, MessageKey>;

const ASSIGNMENT_REASON_KEYS = {
  deadline_today: "dayplan.assigned.reason.deadline_today",
  importance: "dayplan.assigned.reason.importance",
  lateness: "dayplan.assigned.reason.lateness",
  fits_energy: "dayplan.assigned.reason.fits_energy",
} as const satisfies Record<string, MessageKey>;

function reasonLabel(keys: Readonly<Record<string, MessageKey>>, id: string | undefined): Label | null {
  if (!id) return null;
  return Object.hasOwn(keys, id) ? { key: keys[id]! } : { text: id };
}

/** Why a Task is still in the pool; null before the day is planned, when there is no reason. */
export const poolReasonLabel = (id: string | undefined): Label | null => reasonLabel(POOL_REASON_KEYS, id);

/** Why a Task was given to a Resident. */
export const assignmentReasonLabel = (id: string | undefined): Label | null =>
  reasonLabel(ASSIGNMENT_REASON_KEYS, id);
