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
  rejected: number;
  cost: number;
  uncosted: number;
}

/** A list of one service's days, summed. It serves a single day, the range and the previous range alike. */
function figures(days: ServiceDay[]): Figures {
  const f: Figures = { calls: 0, failures: 0, attempts: 0, rejected: 0, cost: 0, uncosted: 0 };
  for (const s of days) {
    f.calls += callsOf(s);
    f.failures += failuresOf(s);
    f.attempts += attemptsOf(s);
    f.rejected += s.outcomes.rejected_by_referee;
    f.cost += s.estCostMicros;
    f.uncosted += s.uncostedCalls;
  }
  return f;
}

/** The two services' figures combined. */
function sum(a: Figures, b: Figures): Figures {
  return {
    calls: a.calls + b.calls,
    failures: a.failures + b.failures,
    attempts: a.attempts + b.attempts,
    rejected: a.rejected + b.rejected,
    cost: a.cost + b.cost,
    uncosted: a.uncosted + b.uncosted,
  };
}

function costHeadline(kind: string, perDay: Figures[], total: Figures, prev: Figures | undefined): CostHeadline {
  const series = perDay.map((f) => f.cost);
  return {
    micros: total.cost,
    uncosted: total.uncosted,
    series,
    label: describeSeries(`Estimated ${kind} cost`, series, formatMicros),
    delta: changeDelta("money", total.cost, prev?.cost),
  };
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
  const forService = (service: "allocator" | "explainer") => {
    const days = usage.days.map((d) => d.services[service]);
    const previous = usage.previous?.services[service];
    return {
      perDay: days.map((s) => figures([s])),
      total: figures(days),
      prev: previous && figures([previous]),
    };
  };
  const allocator = forService("allocator");
  const explainer = forService("explainer");

  const perDay = allocator.perDay.map((a, i) => sum(a, explainer.perDay[i]!));
  const total = sum(allocator.total, explainer.total);
  const prev = allocator.prev && explainer.prev && sum(allocator.prev, explainer.prev);

  const failureSeries = perDay.map((f) => percentOf(f.failures, f.attempts));
  const refereeSeries = allocator.perDay.map((f) => percentOf(f.rejected, f.calls));
  const pct = (n: number) => `${n}%`;

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
      part: allocator.total.rejected,
      whole: allocator.total.calls,
      value: formatPercent(allocator.total.rejected, allocator.total.calls),
      series: refereeSeries,
      label: describeSeries("Referee rejection rate", refereeSeries, pct, "no allocator calls"),
      delta: rateDelta(
        { part: allocator.total.rejected, whole: allocator.total.calls },
        allocator.prev && { part: allocator.prev.rejected, whole: allocator.prev.calls },
      ),
      status: refereeStatus(allocator.total.rejected, allocator.total.calls),
    },
    cost: {
      allocator: costHeadline("allocator", allocator.perDay, allocator.total, allocator.prev),
      explainer: costHeadline("explainer", explainer.perDay, explainer.total, explainer.prev),
    },
  };
}
