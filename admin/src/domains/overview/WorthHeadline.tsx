import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "../../shared/Button";
import { changeDelta, type DeltaResult, type Ratio } from "../../shared/delta";
import { Delta } from "../../shared/Delta";
import { formatMicros, formatPercent } from "../../shared/format";
import type { Range } from "../../shared/range";
import { Sparkline } from "../../shared/Sparkline";
import { StatusBadge } from "../../shared/StatusBadge";
import {
  fallbackStatus,
  MIN_ALLOCATOR_CALLS,
  MIN_PROPOSED_PER_ARM,
  monthStatus,
  refereeStatus,
} from "../../shared/thresholds";
import {
  armRates,
  completionRatio,
  costPerLlmRun,
  explanationShare,
  fallbackShare,
  hasWorthData,
  llmShare,
  ratioSeries,
  refereeRate,
  refuseRatio,
  sampledRateDelta,
  seriesLabel,
} from "./headline";
import { useWorth, type ArmOutcome, type Worth } from "./worth";

/**
 * "Is the AI worth it?": four measures for the range, each with its change against the previous range and a
 * sparkline. It owns its query, so it fails, loads and retries independently of the daily tables below it.
 */
export function WorthHeadline({ range }: { range: Range }) {
  const query = useWorth(range);
  return (
    <section aria-labelledby="worth" data-worth className="mt-4">
      <h2 id="worth" className="mb-2 text-xl font-semibold">
        Is the AI worth it?
      </h2>
      {query.isError ? (
        <div role="alert" className="rounded-control border-2 border-danger p-4">
          <p className="m-0 font-semibold">The headline could not be loaded.</p>
          <Button className="mt-3" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : query.data === undefined ? (
        <p role="status" className="text-muted">
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
    <section aria-labelledby={id} data-card={name} className="rounded-control border border-border bg-surface-raised px-4 py-3">
      <h3 id={id} className="m-0 mb-2 text-base font-semibold">
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
  seriesName,
  format,
}: {
  label: string;
  value: string;
  status?: { state: "ok" | "warn" | "bad" | "neutral"; label: string };
  delta?: DeltaResult;
  deltaKind?: "rate" | "money";
  days: number;
  series?: (number | null)[];
  seriesName?: string;
  format?: (value: number) => string;
}) {
  return (
    <div className="mb-3">
      <p className="m-0 text-sm text-muted">{label}</p>
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {status && <StatusBadge state={status.state} label={status.label} />}
      </p>
      {delta && (
        <p className="m-0">
          <Delta kind={deltaKind} result={delta} days={days} />
        </p>
      )}
      {series && seriesName && <Sparkline values={series} label={seriesLabel(seriesName, series, format)} />}
    </div>
  );
}

function OutcomeCard({ worth }: { worth: Worth }) {
  const days = worth.days.length;
  const arms = [
    { name: "LLM", arm: worth.current.outcome.llm, previous: worth.previous?.outcome.llm, pick: (d: Worth["current"]) => d.outcome.llm },
    { name: "Baseline", arm: worth.current.outcome.baseline, previous: worth.previous?.outcome.baseline, pick: (d: Worth["current"]) => d.outcome.baseline },
  ];
  const rateRow = (label: string, ratio: (arm: ArmOutcome) => Ratio) => (
    <tr>
      <th scope="row" className="py-2 pr-3 text-left font-semibold align-top">
        {label}
      </th>
      {arms.map(({ name, arm, previous, pick }) => {
        const rates = armRates(arm);
        if (rates === "not-enough-data") {
          return (
            <td key={name} className="py-2 align-top">
              <StatusBadge state="neutral" label="Not enough data" />
            </td>
          );
        }
        const series = ratioSeries(worth.days, (d) => ratio(pick(d)));
        return (
          <td key={name} className="py-2 align-top">
            <span className="text-2xl font-bold tabular-nums">{formatPercent(ratio(arm).part, ratio(arm).whole)}</span>
            <br />
            <Delta kind="rate" result={sampledRateDelta(ratio(arm), previous && ratio(previous), MIN_PROPOSED_PER_ARM)} days={days} />
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
            {arms.map(({ name }) => (
              <th key={name} scope="col" className="text-left">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rateRow("Completion rate", completionRatio)}
          {rateRow("Refuse rate (lower bound)", refuseRatio)}
          <tr>
            <th scope="row" className="py-2 pr-3 text-left font-semibold">
              Proposed Tasks (n)
            </th>
            {arms.map(({ name, arm }) => (
              <td key={name} className="py-2 tabular-nums">
                {arm.proposed}
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
  const days = worth.days.length;
  const r = worth.current.reliability;
  const p = worth.previous?.reliability;
  const fallback = fallbackShare(r);
  const referee = refereeRate(r);
  const fallbackSeries = ratioSeries(worth.days, (d) => fallbackShare(d.reliability));
  const llmSeries = ratioSeries(worth.days, (d) => llmShare(d.reliability));
  const refereeSeries = ratioSeries(worth.days, (d) => refereeRate(d.reliability));
  return (
    <Card name="reliability" title="Reliability">
      <Figure
        label="Planned by the LLM"
        value={formatPercent(llmShare(r).part, llmShare(r).whole)}
        delta={sampledRateDelta(llmShare(r), p && llmShare(p), MIN_ALLOCATOR_CALLS)}
        days={days}
        series={llmSeries}
        seriesName="Planned by the LLM"
      />
      <Figure
        label="Fell back to baseline"
        value={formatPercent(fallback.part, fallback.whole)}
        status={fallbackStatus(fallback.part, fallback.whole)}
        delta={sampledRateDelta(fallback, p && fallbackShare(p), MIN_ALLOCATOR_CALLS)}
        days={days}
        series={fallbackSeries}
        seriesName="Fell back to baseline"
      />
      <Figure
        label="Referee rejection rate"
        value={formatPercent(referee.part, referee.whole)}
        status={refereeStatus(referee.part, referee.whole)}
        delta={sampledRateDelta(referee, p && refereeRate(p), MIN_ALLOCATOR_CALLS)}
        days={days}
        series={refereeSeries}
        seriesName="Referee rejection rate"
      />
      <Note>
        {r.runsLlmNotAsked} {r.runsLlmNotAsked === 1 ? "run where the LLM was not asked is" : "runs where the LLM was not asked are"} excluded.
      </Note>
    </Card>
  );
}

function CostCard({ worth, range }: { worth: Worth; range: Range }) {
  const days = worth.days.length;
  const perRun = costPerLlmRun(worth.current);
  const previousPerRun = worth.previous && costPerLlmRun(worth.previous);
  const series = worth.days.map((d) => {
    const v = costPerLlmRun(d);
    return v === null ? null : Math.round(v);
  });
  const delta: DeltaResult =
    perRun === null || previousPerRun == null ? { type: "none" } : changeDelta("money", Math.round(perRun), Math.round(previousPerRun));
  const month = worth.monthToDate;
  const lowerBound = worth.current.cost.uncostedCalls > 0;
  return (
    <Card name="cost" title="Cost">
      <Figure
        label="Estimated allocator cost per LLM-planned Allocation"
        value={perRun === null ? "n/a" : formatMicros(Math.round(perRun))}
        delta={delta}
        deltaKind="money"
        days={days}
        series={series}
        seriesName="Estimated allocator cost per LLM-planned Allocation"
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
        days={days}
      />
      <Note>
        Estimated cost. Explainer cost is not included; see <Link to={`/ai?range=${range}`}>AI usage</Link>.
      </Note>
    </Card>
  );
}

function ExplanationCard({ worth }: { worth: Worth }) {
  const days = worth.days.length;
  const e = explanationShare(worth.current.explanations);
  const share = ratioSeries(worth.days, (d) => explanationShare(d.explanations));
  return (
    <Card name="explanations" title="Explanation share">
      <Figure
        label="Day Plan explanations written by the LLM"
        value={formatPercent(e.part, e.whole)}
        delta={sampledRateDelta(e, worth.previous && explanationShare(worth.previous.explanations), 1)}
        days={days}
        series={share}
        seriesName="Day Plan explanations written by the LLM"
      />
      <p className="m-0 text-sm text-muted">
        Written from the template: {formatPercent(e.whole - e.part, e.whole)}
      </p>
    </Card>
  );
}
