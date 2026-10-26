import { useEffect } from "react";
import { BarTable, BarTableSkeleton, type BarColumn } from "../../shared/BarTable";
import { Button } from "../../shared/Button";
import { Collapsible } from "../../shared/Collapsible";
import { Delta } from "../../shared/Delta";
import { Sparkline } from "../../shared/Sparkline";
import { rangeDays, useRange } from "../../shared/range";
import { RangeControl } from "../../shared/RangeControl";
import { fallbackHeadline } from "./headline";
import { useOverview,type Overview, type OverviewDay } from "./api";

const COLUMNS: BarColumn<OverviewDay>[] = [
  { key: "runs", label: "Runs", value: (d) => d.runs },
  { key: "rejected", label: "Rejected", value: (d) => d.rejected },
  { key: "fallbacks", label: "Fallbacks", value: (d) => d.fallbacks },
  { key: "checkins", label: "Check-ins", value: (d) => d.checkins },
  { key: "completions", label: "Completions", value: (d) => d.completions },
  { key: "refuses", label: "Refuses (lower bound)", value: (d) => d.refuses },
  { key: "takes", label: "Takes", value: (d) => d.takes },
  { key: "swaps", label: "Swaps accepted", value: (d) => d.swapsAccepted },
  { key: "delivered", label: "Pushes accepted by push service", value: (d) => d.pushes.delivered },
  { key: "failed", label: "Pushes failed", value: (d) => d.pushes.failed },
  { key: "gone", label: "Pushes gone", value: (d) => d.pushes.gone },
  { key: "unknown", label: "Pushes unknown outcome", value: (d) => d.pushes.unknown },
];

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control border border-border bg-surface-raised px-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

/** The system's activity for the last 7 or 30 days: aggregates only, as tables with bars. */
export function OverviewPage() {
  const [range, setRange] = useRange();
  const query = useOverview(range);

  useEffect(() => {
    document.title = "Overview · Homeowner admin";
  }, []);

  const caption = `Activity per day, last ${rangeDays(range)} days`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Overview</h1>
        <RangeControl value={range} onChange={setRange} />
      </div>

      {query.isError ? (
        <div role="alert" className="my-4 rounded-control border-2 border-danger p-4">
          <p className="m-0 font-semibold">The overview could not be loaded.</p>
          <Button className="mt-3" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : query.data === undefined ? (
        <div role="status" className="mt-4">
          <p className="text-muted">Loading the overview…</p>
          <BarTableSkeleton caption={caption} rowHeader="Date" columns={COLUMNS} rowCount={rangeDays(range)} />
        </div>
      ) : (
        <Loaded overview={query.data} caption={caption} />
      )}
    </>
  );
}

/**
 * The headline kit on one real figure. It has no status badge on purpose: this ratio counts every run, including those
 * where the LLM was never asked, so the 20% and 40% Fallback share thresholds would mislead. The headline Fallback
 * share replaces it later.
 */
function FallbackTile({ overview }: { overview: Overview }) {
  const h = fallbackHeadline(overview);
  return (
    <section aria-labelledby="fallbacks" data-headline className="mt-4 rounded-control border border-border bg-surface-raised px-4 py-3">
      <h2 id="fallbacks" className="m-0 text-base font-semibold text-muted">
        Fallbacks per run (all runs)
      </h2>
      <p className="m-0 text-2xl font-bold tabular-nums">
        {h.value}{" "}
        <Delta kind="rate" result={h.delta} days={overview.days.length} />
      </p>
      <Sparkline values={h.series} label={h.label} />
    </section>
  );
}

function Loaded({ overview, caption }: { overview: Overview; caption: string }) {
  const { totals, active } = overview;
  return (
    <>
      <FallbackTile overview={overview} />

      <section aria-labelledby="totals" className="mt-6">
        <h2 id="totals" className="mb-2 text-xl font-semibold">
          Totals
        </h2>
        <dl className="m-0 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Users" value={totals.users} />
          <Tile label="Homes" value={totals.homes} />
          <Tile label="Residents" value={totals.residents} />
          <Tile label="Chores" value={totals.chores} />
        </dl>
      </section>

      <section aria-labelledby="active" className="mt-6">
        <h2 id="active" className="mb-2 text-xl font-semibold">
          Active in this range
        </h2>
        <dl className="m-0 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Active Homes" value={active.homes} />
          <Tile label="Active Residents" value={active.residents} />
        </dl>
        <p className="text-sm text-muted">Active means a Check-in, Commitment or Completion in the range.</p>
      </section>

      <section aria-labelledby="days" className="mt-6">
        <h2 id="days" className="mb-2 text-xl font-semibold">
          Per day
        </h2>
        {overview.days.every((d) => COLUMNS.every((c) => c.value(d) === 0)) && <p className="font-semibold">No activity in this range</p>}
        <Collapsible title="Show per-day table">
          <BarTable caption={caption} rowHeader="Date" columns={COLUMNS} rows={overview.days.map((d) => ({ id: d.date, label: d.date, data: d }))} />
          <ul className="mt-3 list-disc pl-6 text-sm text-muted">
            <li>Refuses is a lower bound: a refused Task that is taken later is not counted.</li>
            <li>Pushes accepted by push service were taken by the push service, not necessarily shown on a phone.</li>
            <li>Pushes unknown outcome (sent before tracking, or dropped at the deadline) have no recorded answer from the push service.</li>
            <li>Each bar is scaled to the largest value in its own column.</li>
          </ul>
        </Collapsible>
      </section>
    </>
  );
}
