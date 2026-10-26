// The headline rules, fixed in code: they are not editable from the UI. "Above" means strictly greater, and every
// comparison is on integers (`part * 100 > whole * 20`) so float rounding can never flip a boundary case.

export type StatusState = "ok" | "warn" | "bad" | "neutral";

export interface Status {
  state: StatusState;
  label: string;
}

/** Fewest proposed Tasks per arm before a comparison between arms is judged. */
export const MIN_PROPOSED_PER_ARM = 20;
/** Fewest allocator calls before a rate over them is judged. */
export const MIN_ALLOCATOR_CALLS = 20;

const NOT_ENOUGH_DATA: Status = { state: "neutral", label: "Not enough data" };

export function hasSample(n: number, min: number): boolean {
  return n >= min;
}

/** Baseline fallback share: warn above 20%, bad above 40%. `asked` is the runs where the LLM was asked. */
export function fallbackStatus(fallbacks: number, asked: number): Status {
  if (!hasSample(asked, MIN_ALLOCATOR_CALLS)) return NOT_ENOUGH_DATA;
  if (fallbacks * 100 > asked * 40) return { state: "bad", label: "Fallback share high" };
  if (fallbacks * 100 > asked * 20) return { state: "warn", label: "Fallback share elevated" };
  return { state: "ok", label: "Fallback share normal" };
}

/** Referee rejection rate: warn above 15%. */
export function refereeStatus(rejected: number, calls: number): Status {
  if (!hasSample(calls, MIN_ALLOCATOR_CALLS)) return NOT_ENOUGH_DATA;
  if (rejected * 100 > calls * 15) return { state: "warn", label: "Rejections elevated" };
  return { state: "ok", label: "Rejections normal" };
}

/** Month-to-date spend against the monthly limit: warn above 80%, bad above 100%, neutral with no limit. */
export function monthStatus(costMicros: number, limitMicros: number | null): Status {
  if (limitMicros === null || limitMicros <= 0) return { state: "neutral", label: "No limit set" };
  if (costMicros > limitMicros) return { state: "bad", label: "Over the limit" };
  if (costMicros * 100 > limitMicros * 80) return { state: "warn", label: "Near the limit" };
  return { state: "ok", label: "Within the limit" };
}
