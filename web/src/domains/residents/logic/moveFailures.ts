import type { MessageKey } from "../../../shared/i18n";
import type { MoveRejection, MoveResult } from "../api/api";
import type { pickedProblem } from "./completionTimeBounds";

type Failure = Exclude<MoveResult, { kind: "ok" }>;

/**
 * What to tell the Resident for each way moving a Completion can fail: the API's codes, then the other answers.
 * `satisfies` makes the table exhaustive both ways, so a new code or kind fails the typecheck until it has a
 * message. The wording is calm: no alarm colour, no "!", and no blame.
 */
export const MOVE_FAILURE_KEY = {
  in_future: "completion.changeTime.in_future",
  too_old: "completion.changeTime.too_old",
  before_task: "completion.changeTime.before_task",
  invalid_completed_at: "completion.changeTime.invalid",
  not_yours: "completion.changeTime.not_yours",
  "not-found": "completion.changeTime.notFound",
  // The dialog only exists with a Home, so a 404 `no home` is a failed save like any other.
  none: "completion.changeTime.error",
  "not-signed-in": "dayplan.notSignedIn",
  offline: "completion.changeTime.offline",
  error: "completion.changeTime.error",
} as const satisfies Record<MoveRejection | Exclude<Failure["kind"], "rejected">, MessageKey>;

export function moveFailureKey(failure: Failure): MessageKey {
  return MOVE_FAILURE_KEY[failure.kind === "rejected" ? failure.code : failure.kind];
}

/** The message for a value the picker itself refused, before any call. */
export function pickedProblemKey(problem: NonNullable<ReturnType<typeof pickedProblem>>): MessageKey {
  return MOVE_FAILURE_KEY[problem === "invalid" ? "invalid_completed_at" : problem];
}
