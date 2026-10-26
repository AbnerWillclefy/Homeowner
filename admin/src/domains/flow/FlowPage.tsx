import { useEffect } from "react";
import { Button } from "../../shared/Button";
import { barPercent, useRange } from "../../shared/range";
import { RangeControl } from "../../shared/RangeControl";
import { useFlow } from "./api";
import { buildFunnel, isEmptyFlow, type FunnelRow } from "./funnel";

/** An outlined flag. The text carries the meaning; the icon repeats it and the heavier border adds to it. */
function WeakestBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-control border-2 border-danger px-2 py-0.5 text-sm font-bold text-danger">
      <svg role="img" aria-label="Warning" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 2 21h20L12 3Z" />
        <path d="M12 10v5M12 18h.01" />
      </svg>
      Weakest step
    </span>
  );
}

function Step({ row, first }: { row: FunnelRow; first: number }) {
  return (
    <li className={`m-0 rounded-control p-3 ${row.weakest ? "border-4 border-danger" : "border border-border"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="m-0 text-base font-semibold">
          {row.label}
          {row.description !== null && <span className="font-normal text-muted"> ({row.description})</span>}
        </h2>
        <p className="m-0 text-xl font-bold tabular-nums">{row.count}</p>
      </div>
      <div aria-hidden="true" className="my-2 h-3 w-full overflow-hidden rounded-control border border-border">
        <div data-bar="" className={`h-full ${row.weakest ? "bg-danger" : "bg-accent"}`} style={{ width: `${barPercent(row.count, first)}%` }} />
      </div>
      <p className="m-0 flex flex-wrap items-center gap-2">
        {row.rateText !== "" && <span>{row.rateText}</span>}
        {row.weakest && <WeakestBadge />}
      </p>
    </li>
  );
}

function Skeleton() {
  return (
    <div role="status" className="mt-4">
      <p className="text-muted">Loading the flow…</p>
      <ol aria-hidden="true" className="m-0 flex list-none flex-col gap-3 p-0">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="m-0 rounded-control border border-border p-3">
            <span className="block h-5 w-1/2 rounded-control bg-border/40 motion-safe:animate-pulse" />
            <span className="mt-3 block h-3 w-full rounded-control bg-border/40 motion-safe:animate-pulse" />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** One day's pipeline as a funnel, totalled over the range: how many got through each step, and where it leaks. */
export function FlowPage() {
  const [range, setRange] = useRange();
  const query = useFlow(range);

  useEffect(() => {
    document.title = "Flow · Homeowner admin";
  }, []);

  const steps = query.data?.steps;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Flow</h1>
        <RangeControl value={range} onChange={setRange} />
      </div>

      {query.isError ? (
        <div role="alert" className="my-4 rounded-control border-2 border-danger p-4">
          <p className="m-0 font-semibold">The flow could not be loaded.</p>
          <Button className="mt-3" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : steps === undefined ? (
        <Skeleton />
      ) : isEmptyFlow(steps) ? (
        <p className="mt-4 font-semibold">No pipeline activity in this range</p>
      ) : (
        <Funnel rows={buildFunnel(steps)} />
      )}
    </>
  );
}

function Funnel({ rows }: { rows: FunnelRow[] }) {
  const first = rows[0]?.count ?? 0;
  return (
    <>
      <ol aria-label="Pipeline steps, in order" className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
        {rows.map((row) => (
          <Step key={row.id} row={row} first={first} />
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
