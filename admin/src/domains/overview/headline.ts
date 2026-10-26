import { rateDelta, type DeltaResult } from "../../shared/delta";
import { formatPercent } from "../../shared/format";
import type { Overview } from "./api";

export interface FallbackHeadline {
  fallbacks: number;
  runs: number;
  /** "20%", or "n/a" with no runs. */
  value: string;
  /** Per-day percent, `null` for a day with no runs. */
  series: (number | null)[];
  /** The sparkline's text alternative. */
  label: string;
  delta: DeltaResult;
}

/**
 * Fallbacks per run over the range, from the per-day counters. It counts every run, including those where the LLM was
 * never asked, so it is not the Fallback share of the AI usage page.
 */
export function fallbackHeadline(overview: Overview): FallbackHeadline {
  const fallbacks = overview.days.reduce((sum, d) => sum + d.fallbacks, 0);
  const runs = overview.days.reduce((sum, d) => sum + d.runs, 0);
  const series = overview.days.map((d) => (d.runs > 0 ? Math.round((d.fallbacks / d.runs) * 100) : null));
  const known = series.filter((v): v is number => v !== null);
  const prefix = `Fallbacks per run, per day, last ${overview.days.length} days:`;
  const label =
    known.length === 0 ? `${prefix} no runs` : `${prefix} ${known[0]}% to ${known.at(-1)}%, highest ${Math.max(...known)}%`;
  const previous = overview.previous;
  return {
    fallbacks,
    runs,
    value: formatPercent(fallbacks, runs),
    series,
    label,
    delta: rateDelta({ part: fallbacks, whole: runs }, previous && { part: previous.fallbacks, whole: previous.runs }),
  };
}
