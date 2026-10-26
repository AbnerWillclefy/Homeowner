import { changeDelta, rateDelta, type DeltaResult } from "../../shared/delta";
import { formatMicros, formatPercent } from "../../shared/format";
import { refereeStatus, type Status } from "../../shared/thresholds";
import type { AiUsage, ServiceDay } from "./api";

/**
 * The calls the model was asked: every outcome except the two skips. The same rule as `/admin/flow`'s `llmAsked`, so
 * the pages agree.
 */
export function callsOf(s: ServiceDay): number {
  const o = s.outcomes;
  return o.accepted + o.rejected_by_referee + o.invalid_response + o.timeout + o.error;
}

/** Failures: a timeout, an error, or a call skipped by the daily cap. */
function failuresOf(s: ServiceDay): number {
  return s.outcomes.timeout + s.outcomes.error + s.outcomes.skipped_cap;
}

/** Attempts: every outcome, skips included. The denominator of the failure share. */
function attemptsOf(s: ServiceDay): number {
  return callsOf(s) + s.outcomes.skipped_cap + s.outcomes.skipped_budget;
}

interface Figures {
  calls: number;
  failures: number;
  attempts: number;
  allocatorCalls: number;
  refereeRejected: number;
  allocatorCost: number;
  explainerCost: number;
  allocatorUncosted: number;
  explainerUncosted: number;
}

/** One list of (allocator, explainer) pairs, summed. It serves a single day, the range and the previous range alike. */
function figures(pairs: { allocator: ServiceDay; explainer: ServiceDay }[]): Figures {
  const f: Figures = {
    calls: 0, failures: 0, attempts: 0, allocatorCalls: 0, refereeRejected: 0,
    allocatorCost: 0, explainerCost: 0, allocatorUncosted: 0, explainerUncosted: 0,
  };
  for (const { allocator, explainer } of pairs) {
    for (const s of [allocator, explainer]) {
      f.calls += callsOf(s);
      f.failures += failuresOf(s);
      f.attempts += attemptsOf(s);
    }
    f.allocatorCalls += callsOf(allocator);
    f.refereeRejected += allocator.outcomes.rejected_by_referee;
    f.allocatorCost += allocator.estCostMicros;
    f.explainerCost += explainer.estCostMicros;
    f.allocatorUncosted += allocator.uncostedCalls;
    f.explainerUncosted += explainer.uncostedCalls;
  }
  return f;
}

function describeSeries(title: string, series: (number | null)[], unit: (n: number) => string, empty = "no data"): string {
  const prefix = `${title}, per day, last ${series.length} days:`;
  const known = series.filter((v): v is number => v !== null);
  if (known.length === 0) return `${prefix} ${empty}`;
  return `${prefix} ${unit(known[0]!)} to ${unit(known.at(-1)!)}, highest ${unit(Math.max(...known))}`;
}

const percentOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

export interface CountHeadline {
  value: number;
  series: number[];
  label: string;
  delta: DeltaResult;
}

export interface RateHeadline {
  part: number;
  whole: number;
  /** "19%", or "n/a" with nothing to divide by. */
  value: string;
  /** Per-day percent, `null` for a day with a zero denominator. */
  series: (number | null)[];
  label: string;
  delta: DeltaResult;
}

export interface CostHeadline {
  micros: number;
  /** Calls with no price in the range: the figure is a lower bound. */
  uncosted: number;
  series: number[];
  label: string;
  delta: DeltaResult;
}

export interface AiHeadline {
  calls: CountHeadline;
  /** Both services, over all attempts. Neutral: no badge. */
  failure: RateHeadline;
  /** Allocator only, over its calls. */
  referee: RateHeadline & { status: Status };
  cost: { allocator: CostHeadline; explainer: CostHeadline };
}

/** The five key numbers of the AI usage page, from the daily rows and the optional `previous` block. */
export function aiHeadline(usage: AiUsage): AiHeadline {
  const perDay = usage.days.map((d) => figures([d.services]));
  const total = figures(usage.days.map((d) => d.services));
  const prev = usage.previous && figures([usage.previous.services]);

  const failureSeries = perDay.map((f) => percentOf(f.failures, f.attempts));
  const refereeSeries = perDay.map((f) => percentOf(f.refereeRejected, f.allocatorCalls));
  const pct = (n: number) => `${n}%`;

  const cost = (kind: "allocator" | "explainer"): CostHeadline => {
    const micros = kind === "allocator" ? total.allocatorCost : total.explainerCost;
    const series = perDay.map((f) => (kind === "allocator" ? f.allocatorCost : f.explainerCost));
    const previous = prev && (kind === "allocator" ? prev.allocatorCost : prev.explainerCost);
    return {
      micros,
      uncosted: kind === "allocator" ? total.allocatorUncosted : total.explainerUncosted,
      series,
      label: describeSeries(`Estimated ${kind} cost`, series, formatMicros),
      delta: changeDelta("money", micros, previous),
    };
  };

  const callSeries = perDay.map((f) => f.calls);
  return {
    calls: {
      value: total.calls,
      series: callSeries,
      label: describeSeries("Total LLM calls", callSeries, String),
      delta: changeDelta("count", total.calls, prev?.calls),
    },
    failure: {
      part: total.failures,
      whole: total.attempts,
      value: formatPercent(total.failures, total.attempts),
      series: failureSeries,
      label: describeSeries("Failure share", failureSeries, pct, "no attempts"),
      delta: rateDelta({ part: total.failures, whole: total.attempts }, prev && { part: prev.failures, whole: prev.attempts }),
    },
    referee: {
      part: total.refereeRejected,
      whole: total.allocatorCalls,
      value: formatPercent(total.refereeRejected, total.allocatorCalls),
      series: refereeSeries,
      label: describeSeries("Referee rejection rate", refereeSeries, pct, "no allocator calls"),
      delta: rateDelta(
        { part: total.refereeRejected, whole: total.allocatorCalls },
        prev && { part: prev.refereeRejected, whole: prev.allocatorCalls },
      ),
      status: refereeStatus(total.refereeRejected, total.allocatorCalls),
    },
    cost: { allocator: cost("allocator"), explainer: cost("explainer") },
  };
}
