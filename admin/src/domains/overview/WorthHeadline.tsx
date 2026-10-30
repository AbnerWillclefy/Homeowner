import type { ReactNode } from "react";
import { Link } from "react-router";
import type { DeltaResult, Ratio } from "../../shared/delta";
import { Delta } from "../../shared/Delta";
import { formatMicros, formatPercent } from "../../shared/format";
import { LoadError } from "../../shared/LoadError";
import type { Range } from "../../shared/range";
import { Sparkline } from "../../shared/Sparkline";
import { StatusBadge } from "../../shared/StatusBadge";
import {
  fallbackStatus,
  MIN_ALLOCATOR_CALLS,
  MIN_PROPOSED_PER_ARM,
  monthStatus,
  refereeStatus,
  type Status,
} from "../../shared/thresholds";
import {
  completionRatio,
  costDelta,
  costPerLlmRun,
  explanationShare,
  fallbackShare,
  hasEnoughData,
  hasWorthData,
  llmShare,
  ratioSeries,
  refereeRate,
  refuseRatio,
  sampledRateDelta,
  seriesLabel,
} from "./headline";
import { useWorth, type ArmOutcome, type Worth, type WorthCounts } from "./worth";

/**
 * "Is the AI worth it?": four measures for the range, each with its change against the previous range and a
 * sparkline. It owns its query, so it fails, loads and retries independently of the daily tables below it.
 */
export function WorthHeadline({ range }: { range: Range }) {
  const query = useWorth(range);
  return (
    <section aria-labelledby="worth" data-worth>
      <h2 id="worth" className="mb-3 text-base font-semibold">
        Is the AI worth it?
      </h2>
      {query.isError ? (
        <LoadError what="The headline" onRetry={() => void query.refetch()} />
      ) : query.data === undefined ? (
        <p role="status" className="text-sm text-muted">
          Loading the headline…
        </p>
      ) : (
        <Loaded worth={query.data} range={range} />
      )}
    </section>
  );
}

function Loaded({ worth, range }: { worth: Worth; range: Range }) {
  const empty = !hasWorthData(worth.current);
  return (
    <>
      {empty && <p className="font-semibold">No data in this range</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <OutcomeCard worth={worth} />
        <ReliabilityCard worth={worth} />
        <CostCard worth={worth} range={range} />
        <ExplanationCard worth={worth} />
      </div>
    </>
  );
}

function Card({ name, title, children }: { name: string; title: string; children: ReactNode }) {
  const id = `worth-${name}`;
  return (
    <section aria-labelledby={id} data-card={name} className="rounded-card border border-border/50 bg-surface-raised p-4">
      <h3 id={id} className="m-0 mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="m-0 mt-2 text-sm text-muted">{children}</p>;
}

/** One key number: label, value, optional badge, the change against the previous range, and a sparkline. */
function Figure({
  label,
  value,
  status,
  delta,
  deltaKind = "rate",
  days,
  series,
  format,
}: {
  label: string;
  value: string;
  status?: Status;
  delta?: DeltaResult;
  deltaKind?: "rate" | "money";
  days: number;
  series?: (number | null)[];
  format?: (value: number) => string;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="m-0 text-sm">{label}</p>
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-2xl font-semibold tabular-nums">{value}</span>
        {status && <StatusBadge state={status.state} label={status.label} />}
      </p>
      {delta && (
        <p className="m-0">
          <Delta kind={deltaKind} result={delta} days={days} />
        </p>
      )}
      {series && <Sparkline values={series} label={seriesLabel(label, series, format)} />}
    </div>
  );
}

/** A `Figure` for a share: it picks the ratio from the range, the previous range and each day, and derives the rest. */
function RatioFigure({
  label,
  worth,
  pick,
  minWhole,
  status,
}: {
  label: string;
  worth: Worth;
  pick: (counts: WorthCounts) => Ratio;
  minWhole: number;
  status?: (ratio: Ratio) => Status;
}) {
  const current = pick(worth.current);
  return (
    <Figure
      label={label}
      value={formatPercent(current.part, current.whole)}
      status={status?.(current)}
      delta={sampledRateDelta(current, worth.previous && pick(worth.previous), minWhole)}
      days={worth.days.length}
      series={ratioSeries(worth.days, pick)}
    />
  );
}

const ARMS = [
  { name: "LLM", key: "llm" },
  { name: "Baseline", key: "baseline" },
] as const;

function OutcomeCard({ worth }: { worth: Worth }) {
  const days = worth.days.length;
  const rateRow = (label: string, ratio: (arm: ArmOutcome) => Ratio) => (
    <tr>
      <th scope="row" className="border-t border-border/40 py-2 pr-3 text-left text-sm font-normal align-top">
        {label}
      </th>
      {ARMS.map(({ name, key }) => {
        const arm = worth.current.outcome[key];
        if (!hasEnoughData(arm)) {
          return (
            <td key={name} className="border-t border-border/40 py-2 align-top">
              <StatusBadge state="neutral" label="Not enough data" />
            </td>
          );
        }
        const r = ratio(arm);
        const previous = worth.previous?.outcome[key];
        const series = ratioSeries(worth.days, (d) => ratio(d.outcome[key]));
        return (
          <td key={name} className="border-t border-border/40 py-2 align-top">
            <span className="font-mono text-2xl font-semibold tabular-nums">{formatPercent(r.part, r.whole)}</span>
            <br />
            <Delta kind="rate" result={sampledRateDelta(r, previous && ratio(previous), MIN_PROPOSED_PER_ARM)} days={days} />
            <Sparkline values={series} label={seriesLabel(`${label}, ${name}`, series)} />
          </td>
        );
      })}
    </tr>
  );
  return (
    <Card name="outcome" title="Resident outcome, LLM vs baseline">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className="text-left">
              <span className="sr-only">Measure</span>
            </th>
            {ARMS.map(({ name }) => (
              <th key={name} scope="col" className="pb-1 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rateRow("Completion rate", completionRatio)}
          {rateRow("Refuse rate (lower bound)", refuseRatio)}
          <tr>
            <th scope="row" className="border-t border-border/40 py-2 pr-3 text-left text-sm font-normal">
              Proposed Tasks (n)
            </th>
            {ARMS.map(({ name, key }) => (
              <td key={name} className="border-t border-border/40 py-2 font-mono tabular-nums">
                {worth.current.outcome[key].proposed}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <Note>Observational, not an A/B test: fallbacks cluster on unusual days and Homes differ between arms.</Note>
      <Note>Refuse rate is a lower bound: a refused Task that is Taken later is not counted. An arm needs {MIN_PROPOSED_PER_ARM} proposed Tasks to show rates.</Note>
    </Card>
  );
}

function ReliabilityCard({ worth }: { worth: Worth }) {
  const r = worth.current.reliability;
  return (
    <Card name="reliability" title="Reliability">
      <RatioFigure label="Planned by the LLM" worth={worth} pick={(c) => llmShare(c.reliability)} minWhole={MIN_ALLOCATOR_CALLS} />
      <RatioFigure
        label="Fell back to baseline"
        worth={worth}
        pick={(c) => fallbackShare(c.reliability)}
        status={(x) => fallbackStatus(x.part, x.whole)}
        minWhole={MIN_ALLOCATOR_CALLS}
      />
      <RatioFigure
        label="Referee rejection rate"
        worth={worth}
        pick={(c) => refereeRate(c.reliability)}
        status={(x) => refereeStatus(x.part, x.whole)}
        minWhole={MIN_ALLOCATOR_CALLS}
      />
      <Note>
        {r.runsLlmNotAsked} {r.runsLlmNotAsked === 1 ? "run where the LLM was not asked is" : "runs where the LLM was not asked are"} excluded.
      </Note>
    </Card>
  );
}

function CostCard({ worth, range }: { worth: Worth; range: Range }) {
  const perRun = costPerLlmRun(worth.current);
  const month = worth.monthToDate;
  const lowerBound = worth.current.cost.uncostedCalls > 0;
  return (
    <Card name="cost" title="Cost">
      <Figure
        label="Estimated allocator cost per LLM-planned Allocation"
        value={perRun === null ? "n/a" : formatMicros(perRun)}
        delta={costDelta(worth.current, worth.previous)}
        deltaKind="money"
        days={worth.days.length}
        series={worth.days.map(costPerLlmRun)}
        format={formatMicros}
      />
      {lowerBound && (
        <Note>
          Estimated, and a lower bound: {worth.current.cost.uncostedCalls} {worth.current.cost.uncostedCalls === 1 ? "call has" : "calls have"} no cost estimate.
        </Note>
      )}
      <Figure
        label="Month to date, this calendar month"
        value={month.limitMicros === null ? formatMicros(month.estCostMicros) : `${formatMicros(month.estCostMicros)} of ${formatMicros(month.limitMicros)}`}
        status={monthStatus(month.estCostMicros, month.limitMicros)}
        days={worth.days.length}
      />
      <Note>
        Estimated cost. Explainer cost is not included; see <Link to={`/ai?range=${range}`}>AI usage</Link>.
      </Note>
    </Card>
  );
}

function ExplanationCard({ worth }: { worth: Worth }) {
  const e = explanationShare(worth.current.explanations);
  return (
    <Card name="explanations" title="Explanation share">
      <RatioFigure label="Day Plan explanations written by the LLM" worth={worth} pick={(c) => explanationShare(c.explanations)} minWhole={1} />
      <p className="m-0 mt-2 text-sm text-muted">
        Written from the template: {formatPercent(e.whole - e.part, e.whole)}
      </p>
    </Card>
  );
}
