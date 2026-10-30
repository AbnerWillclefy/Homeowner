import { useEffect } from "react";
import { LoadError } from "../../shared/LoadError";
import { PageHeader } from "../../shared/PageHeader";
import { useRange } from "../../shared/range";
import { useFlow } from "./api";
import { buildFunnel, isEmptyFlow, type FunnelRow } from "./funnel";

/** An outlined flag. The text carries the meaning; the icon repeats it and the heavier border adds to it. */
function WeakestBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-control border border-danger px-2 py-0.5 text-xs font-bold text-danger">
      <svg role="img" aria-label="Warning" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 2 21h20L12 3Z" />
        <path d="M12 10v5M12 18h.01" />
      </svg>
      Weakest step
    </span>
  );
}

function Step({ row, n }: { row: FunnelRow; n: number }) {
  return (
    <li
      data-weakest={row.weakest}
      className={`m-0 grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-3 rounded-card bg-surface-raised px-4 py-3 ${
        row.weakest ? "border border-l-4 border-danger" : "border border-border/50"
      }`}
    >
      <span aria-hidden="true" className="font-mono text-sm text-muted">
        {String(n).padStart(2, "0")}
      </span>
      <h2 className="m-0 font-sans text-sm font-semibold">
        {row.label}
        {row.description !== null && <span className="font-normal text-muted"> ({row.description})</span>}
      </h2>
      <p className="m-0 font-mono text-xl font-semibold tabular-nums">{row.count}</p>
      <div aria-hidden="true" className="col-start-2 col-end-4 my-2 h-1.5 w-full overflow-hidden rounded-control bg-surface">
        <div data-bar="" className={`h-full ${row.weakest ? "bg-danger" : "bg-accent"}`} style={{ width: `${row.barPercent}%` }} />
      </div>
      <p className="col-start-2 col-end-4 m-0 flex flex-wrap items-center gap-2 text-sm text-muted">
        {row.rateText !== "" && <span>{row.rateText}</span>}
        {row.weakest && <WeakestBadge />}
      </p>
    </li>
  );
}

function Skeleton() {
  return (
    <div role="status">
      <p className="text-sm text-muted">Loading the flow…</p>
      <ol aria-hidden="true" className="m-0 flex list-none flex-col gap-2 p-0">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="m-0 rounded-card border border-border/50 bg-surface-raised px-4 py-3">
            <span className="block h-5 w-1/2 rounded-control bg-border/40 motion-safe:animate-pulse" />
            <span className="mt-3 block h-3 w-full rounded-control bg-border/40 motion-safe:animate-pulse" />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Funnel({ rows }: { rows: FunnelRow[] }) {
  return (
    <>
      <ol aria-label="Pipeline steps, in order" className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((row, i) => (
          <Step key={row.id} row={row} n={i + 1} />
        ))}
      </ol>
      <ul className="mt-3 list-disc pl-6 text-sm text-muted">
        <li>Each bar is scaled to the first step, Homes due; a step in another unit can pass it.</li>
        <li>The weakest step has the highest failure or drop rate. Steps with none are never flagged.</li>
        <li>Homes due counts each Home once per day, so it is a count of Home-days.</li>
      </ul>
    </>
  );
}

function FlowBody({ query }: { query: ReturnType<typeof useFlow> }) {
  if (query.isError) {
    return <LoadError what="The flow" onRetry={() => void query.refetch()} />;
  }
  const steps = query.data?.steps;
  if (steps === undefined) return <Skeleton />;
  if (isEmptyFlow(steps)) return <p className="font-semibold">No pipeline activity in this range</p>;
  return <Funnel rows={buildFunnel(steps)} />;
}

/** One day's pipeline as a funnel, totalled over the range: how many got through each step, and where it leaks. */
export function FlowPage() {
  const [range, setRange] = useRange();
  const query = useFlow(range);

  useEffect(() => {
    document.title = "Flow · Homeowner admin";
  }, []);

  return (
    <>
      <PageHeader title="Flow" note="One day's pipeline, totalled over the range: where Homes get through, and where they leak." range={range} onRange={setRange} />
      <FlowBody query={query} />
    </>
  );
}
