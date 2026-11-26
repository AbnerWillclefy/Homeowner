import type { Translate } from "../../../shared/i18n";
import type { Resident } from "../../residents/api/api";
import type { MessageKey } from "../../../shared/i18n";
import { labelText, type Label } from "../../profile/logic/labels";
import type { PlanTask } from "../api/api";
import type { TaskRole } from "./actions";

// The reason ids the Allocation sends. A key that is not in the catalogs fails the typecheck.
const POOL_REASON_KEYS = {
  no_energy_left: "dayplan.pool.reason.no_energy_left",
  restricted_for_all: "dayplan.pool.reason.restricted_for_all",
  weekday_not_allowed: "dayplan.pool.reason.weekday_not_allowed",
  two_person_deferred: "dayplan.pool.reason.two_person_deferred",
  invalid_effort: "dayplan.pool.reason.invalid_effort",
  added_after_plan: "dayplan.pool.reason.added_after_plan",
  refused: "dayplan.pool.reason.refused",
  waiting_for_responsible: "dayplan.pool.reason.waiting_for_responsible",
} as const satisfies Record<string, MessageKey>;

const ASSIGNMENT_REASON_KEYS = {
  deadline_today: "dayplan.assigned.reason.deadline_today",
  importance: "dayplan.assigned.reason.importance",
  lateness: "dayplan.assigned.reason.lateness",
  fits_energy: "dayplan.assigned.reason.fits_energy",
  taken: "dayplan.assigned.reason.taken",
  liked: "dayplan.assigned.reason.liked",
  spared_dislike: "dayplan.assigned.reason.spared_dislike",
  turn_taking: "dayplan.assigned.reason.turn_taking",
  swapped: "dayplan.assigned.reason.swapped",
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

/** The pool reason id for a Task its responsible Resident has not yet been given. Its words carry a name. */
export const WAITING_FOR_RESPONSIBLE = "waiting_for_responsible";

/**
 * "Waiting for {name}". The caller reads "you"; a Resident the list does not hold (loading, failed, or they left
 * after the plan was made, which keeps its reason) reads as the responsible person.
 */
export function waitingForText(t: Translate, resident: Resident | undefined): string {
  if (!resident) return t("dayplan.pool.reason.waiting_for_responsible.unknown");
  if (resident.you) return t("dayplan.pool.reason.waiting_for_responsible.you");
  return t("dayplan.pool.reason.waiting_for_responsible", { name: resident.name });
}

/**
 * The one-line why of a Task, in words: why it was given to someone (`mine` and `other`) or why it is still in
 * the pool. Null when there is no reason (before the day is planned). `responsible` is the Resident a pool Task
 * waits for, which only the shared Residents list knows.
 */
export function taskReasonText(
  t: Translate,
  task: Pick<PlanTask, "reason">,
  role: TaskRole,
  responsible: Resident | undefined,
): string | null {
  const label = (role === "pool" ? poolReasonLabel : assignmentReasonLabel)(task.reason);
  if (!label) return null;
  return role === "pool" && task.reason === WAITING_FOR_RESPONSIBLE ? waitingForText(t, responsible) : labelText(t, label);
}
