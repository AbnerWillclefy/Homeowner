import { useEffect } from "react";
import { DataTable, DataTableSkeleton, type DataColumn } from "../../shared/DataTable";
import { Collapsible } from "../../shared/Collapsible";
import { LoadError } from "../../shared/LoadError";
import { PageHeader } from "../../shared/PageHeader";
import { rangeDays, useRange } from "../../shared/range";
import { TrendChart } from "../../shared/TrendChart";
import { useOverview, type Overview, type OverviewDay } from "./api";
import { WorthHeadline } from "./WorthHeadline";

const COLUMNS: DataColumn<OverviewDay>[] = [
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
    <div className="rounded-card border border-border/50 bg-surface-raised px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="m-0 mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

const SECTION = "mb-3 text-base font-semibold";

/** The system's activity for the last 7 or 30 days: aggregates only, as a trend chart over a table. */
export function OverviewPage() {
  const [range, setRange] = useRange();
  const query = useOverview(range);

  useEffect(() => {
    document.title = "Overview · Homeowner admin";
  }, []);

  const caption = `Activity per day, last ${rangeDays(range)} days`;

  return (
    <>
      <PageHeader title="Overview" note="Is Homeowner working, and is the AI worth it?" range={range} onRange={setRange} />

      <WorthHeadline range={range} />

      {query.isError ? (
        <LoadError what="The overview" onRetry={() => void query.refetch()} />
      ) : query.data === undefined ? (
        <div role="status" className="mt-8">
          <p className="text-sm text-muted">Loading the overview…</p>
          <DataTableSkeleton caption={caption} rowHeader="Date" columns={COLUMNS} rowCount={rangeDays(range)} />
        </div>
      ) : (
        <Loaded overview={query.data} caption={caption} />
      )}
    </>
  );
}

function Loaded({ overview, caption }: { overview: Overview; caption: string }) {
  const { totals, active, days } = overview;
  return (
    <>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="totals" className="lg:col-span-2">
          <h2 id="totals" className={SECTION}>
            Totals
          </h2>
          <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Users" value={totals.users} />
            <Tile label="Homes" value={totals.homes} />
            <Tile label="Residents" value={totals.residents} />
            <Tile label="Chores" value={totals.chores} />
          </dl>
        </section>

        <section aria-labelledby="active">
          <h2 id="active" className={SECTION}>
            Active in this range
          </h2>
          <dl className="m-0 grid grid-cols-2 gap-3">
            <Tile label="Active Homes" value={active.homes} />
            <Tile label="Active Residents" value={active.residents} />
          </dl>
          <p className="text-sm text-muted">Active means a Check-in, Commitment or Completion in the range.</p>
        </section>
      </div>

      <section aria-labelledby="days" className="mt-8">
        <h2 id="days" className={SECTION}>
          Per day
        </h2>
        {days.every((d) => COLUMNS.every((c) => c.value(d) === 0)) && <p className="font-semibold">No activity in this range</p>}
        <TrendChart
          title={caption}
          dates={days.map((d) => d.date)}
          series={[
            { label: "Runs", values: days.map((d) => d.runs) },
            { label: "Check-ins", values: days.map((d) => d.checkins) },
            { label: "Completions", values: days.map((d) => d.completions) },
          ]}
        />
        <Collapsible title="Show per-day table">
          <DataTable caption={caption} rowHeader="Date" columns={COLUMNS} rows={days.map((d) => ({ id: d.date, label: d.date, data: d }))} />
          <ul className="mt-3 list-disc pl-6 text-sm text-muted">
            <li>Refuses is a lower bound: a refused Task that is taken later is not counted.</li>
            <li>Pushes accepted by push service were taken by the push service, not necessarily shown on a phone.</li>
            <li>Pushes unknown outcome (sent before tracking, or dropped at the deadline) have no recorded answer from the push service.</li>
          </ul>
        </Collapsible>
      </section>
    </>
  );
}
