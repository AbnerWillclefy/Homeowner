import type { TemplateReasons } from "./api";

// Short English glosses for the fixed vocabularies the backend reports. Keep them all here. An id that is missing from
// a map is shown raw, so a new kind or reason still renders.

/** Violation kinds from allocation.Check (backend/internal/allocation/types.go). */
export const VIOLATION_GLOSSES: Record<string, string> = {
  over_energy: "a Resident was given more than their energy",
  broken_restriction: "a Task went to a Resident who is restricted from it",
  unknown_task: "the plan named a Task that does not exist",
  duplicate_task: "a Task was given twice",
  wrong_resident_count: "a Task got the wrong number of Residents",
  unknown_resident: "the plan named a Resident that does not exist",
  weekday_not_allowed: "a Task was planned on a weekday it does not allow",
};

/** Fallback reasons of the day plan (backend/internal/dayplan/planner.go): why the baseline planned the day. */
export const FALLBACK_GLOSSES: Record<string, string> = {
  llm_error: "the model call failed",
  llm_timeout: "the model took too long",
  llm_invalid_response: "the model's answer could not be read",
  llm_rejected_by_checker: "the referee rejected the model's plan",
  llm_daily_cap_reached: "the daily call cap was reached",
};

/** Why a Resident's explanation is the template. Keys are the backend's templateReasons. */
export const TEMPLATE_REASON_LABELS: Record<keyof TemplateReasons, string> = {
  skipped_cap: "cap reached",
  skipped_budget: "tick budget spent",
  timeout: "timeout",
  error: "error",
  invalid_response: "invalid answer",
  rejected_by_referee: "rejected by the referee",
  partial: "some summaries rejected",
  notAsked: "not asked (rest day or LLM off)",
};
