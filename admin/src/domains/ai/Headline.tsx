import type { ReactNode } from "react";
import { Delta } from "../../shared/Delta";
import { formatMicros } from "../../shared/format";
import { Sparkline } from "../../shared/Sparkline";
import { StatusBadge } from "../../shared/StatusBadge";
import { monthStatus } from "../../shared/thresholds";
import type { AiUsage } from "./api";
import { aiHeadline, type CostHeadline } from "./headline";

function Tile({ name, title, className = "", children }: { name: string; title: string; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`headline-${name}`} data-headline={name} className={`rounded-card border border-border/50 bg-surface-raised p-4 ${className}`}>
      <h3 id={`headline-${name}`} className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

const valueClass = "m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1";
const figureClass = "font-mono text-2xl font-semibold tabular-nums";

function CostFigure({ title, cost, days }: { title: string; cost: CostHeadline; days: number }) {
  return (
    <div>
      <p className="m-0 text-sm">{title}</p>
      <p className={valueClass}>
        <span className={figureClass}>{formatMicros(cost.micros)}</span> <Delta kind="money" result={cost.delta} days={days} />
      </p>
      {cost.uncosted > 0 && (
        <p className="m-0 text-sm text-muted">
          +{cost.uncosted} {cost.uncosted === 1 ? "call" : "calls"} without a price, so this is a lower bound
        </p>
      )}
      <Sparkline values={cost.series} label={cost.label} />
    </div>
  );
}

/**
 * The five key numbers. Only the referee rejection rate and month to date carry a status; the rest are neutral. Month
 * to date has no previous value, so it shows no change and no sparkline.
 */
export function Headline({ usage, days }: { usage: AiUsage; days: number }) {
  const h = aiHeadline(usage);
  const { estCostMicros, limitMicros } = usage.monthToDate;
  const month = monthStatus(estCostMicros, limitMicros);
  return (
    <section aria-labelledby="headline">
      <h2 id="headline" className="mb-3 text-base font-semibold">
        Key numbers
      </h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Tile name="calls" title="Total LLM calls">
          <p className={valueClass}>
            <span className={figureClass}>{h.calls.value}</span> <Delta kind="count" result={h.calls.delta} days={days} />
          </p>
          <Sparkline values={h.calls.series} label={h.calls.label} />
        </Tile>
        <Tile name="failure" title="Failure share (timeout, error, cap skip)">
          <p className={valueClass}>
            <span className={figureClass}>{h.failure.value}</span> <Delta kind="rate" result={h.failure.delta} days={days} />
          </p>
          <Sparkline values={h.failure.series} label={h.failure.label} />
        </Tile>
        <Tile name="referee" title="Referee rejection rate">
          <p className={valueClass}>
            <span className={figureClass}>{h.referee.value}</span> <Delta kind="rate" result={h.referee.delta} days={days} />
          </p>
          <StatusBadge state={h.referee.status.state} label={h.referee.status.label} />
          <Sparkline values={h.referee.series} label={h.referee.label} />
        </Tile>
        <Tile name="cost" title="Estimated cost" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <CostFigure title="Allocator" cost={h.cost.allocator} days={days} />
            <CostFigure title="Explainer" cost={h.cost.explainer} days={days} />
          </div>
        </Tile>
        <Tile name="month" title="Month to date (estimated)">
          <p className={valueClass}>
            <span className={figureClass}>
              {limitMicros === null ? `${formatMicros(estCostMicros)} estimated` : `${formatMicros(estCostMicros)} of ${formatMicros(limitMicros)} limit`}
            </span>
          </p>
          <StatusBadge state={month.state} label={month.label} />
        </Tile>
      </div>
      <p className="text-sm text-muted">
        Failure share counts timeouts, errors and calls skipped by the daily cap over every attempt, both services. Money is an estimate.
      </p>
    </section>
  );
}
