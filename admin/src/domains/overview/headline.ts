import { changeDelta, rateDelta, type DeltaResult, type Ratio } from "../../shared/delta";
import { MIN_ALLOCATOR_CALLS, MIN_PROPOSED_PER_ARM } from "../../shared/thresholds";
import type { ArmOutcome, WorthCounts, WorthReliability } from "./worth";

// The page divides: /admin/worth sends counts only. Every division here guards a zero denominator, so no figure is
// NaN or infinite.

/** Whether an arm has `MIN_PROPOSED_PER_ARM` proposed Tasks, the least that makes its rates worth showing. */
export function hasEnoughData(arm: ArmOutcome): boolean {
  return arm.proposed >= MIN_PROPOSED_PER_ARM;
}

/** The Outcome rates as parts, for the delta and the sparkline. */
export const completionRatio = (arm: ArmOutcome): Ratio => ({ part: arm.completed, whole: arm.proposed });
export const refuseRatio = (arm: ArmOutcome): Ratio => ({ part: arm.refused, whole: arm.proposed });

/** Fallbacks over the runs where the LLM was asked. Runs where it was not asked are excluded. */
export function fallbackShare(r: WorthReliability): Ratio {
  return { part: r.runsFallback, whole: r.runsLlm + r.runsFallback };
}

/** The complement of the fallback share: the runs the LLM planned. */
export function llmShare(r: WorthReliability): Ratio {
  return { part: r.runsLlm, whole: r.runsLlm + r.runsFallback };
}

/** Referee rejections over allocator calls. */
export function refereeRate(r: WorthReliability): Ratio {
  return { part: r.refereeRejected, whole: r.allocatorCalls };
}

/** Day Plan explanations written by the LLM over all explanations. */
export function explanationShare(e: { llm: number; template: number }): Ratio {
  return { part: e.llm, whole: e.llm + e.template };
}

/** Estimated allocator cost per LLM-planned Allocation in whole micro-USD; null (shown "n/a") with none. */
export function costPerLlmRun(c: WorthCounts): number | null {
  const runs = c.reliability.runsLlm;
  return runs > 0 ? Math.round(c.cost.allocatorCostMicros / runs) : null;
}

/** The change in cost per run; needs `MIN_ALLOCATOR_CALLS` LLM-planned runs in both windows, like the rate deltas. */
export function costDelta(current: WorthCounts, previous: WorthCounts | undefined): DeltaResult {
  if (previous === undefined) return { type: "none" };
  if (current.reliability.runsLlm < MIN_ALLOCATOR_CALLS || previous.reliability.runsLlm < MIN_ALLOCATOR_CALLS) return { type: "none" };
  const now = costPerLlmRun(current);
  const before = costPerLlmRun(previous);
  if (now === null || before === null) return { type: "none" };
  return changeDelta("money", now, before);
}

/** A ratio as a whole percent; null when the denominator is 0, so a sparkline breaks instead of showing 0. */
export function percentOf(ratio: Ratio): number | null {
  return ratio.whole > 0 ? Math.round((ratio.part / ratio.whole) * 100) : null;
}

/** One value per day, for a sparkline. */
export function ratioSeries<T>(days: T[], pick: (day: T) => Ratio): (number | null)[] {
  return days.map((day) => percentOf(pick(day)));
}

/** A rate delta that needs `minWhole` in both windows: a rate over 2 Tasks is not compared with one over 40. */
export function sampledRateDelta(current: Ratio, previous: Ratio | undefined, minWhole: number): DeltaResult {
  if (previous === undefined || current.whole < minWhole || previous.whole < minWhole) return { type: "none" };
  return rateDelta(current, previous);
}

/** The text alternative of a sparkline; `format` writes one value (a percent by default). */
export function seriesLabel(name: string, series: (number | null)[], format: (value: number) => string = (v) => `${v}%`): string {
  const known = series.filter((v): v is number => v !== null);
  const prefix = `${name}, per day, last ${series.length} days:`;
  if (known.length === 0) return `${prefix} no data`;
  return `${prefix} ${format(known[0]!)} to ${format(known.at(-1)!)}, highest ${format(Math.max(...known))}`;
}

/** False for a range where nothing was counted at all. */
export function hasWorthData(c: WorthCounts): boolean {
  const { outcome, reliability: r, explanations: e } = c;
  return [
    outcome.llm.proposed, outcome.baseline.proposed, r.runsLlm, r.runsFallback, r.runsLlmNotAsked, r.allocatorCalls, e.llm, e.template,
  ].some((n) => n > 0);
}
