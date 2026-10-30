import { Button } from "./Button";

/** A failed query: what could not load, and a Retry that refetches. */
export function LoadError({ what, onRetry }: { what: string; onRetry(): void }) {
  return (
    <div role="alert" className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger border-l-4 bg-surface-raised px-4 py-3">
      <p className="m-0 font-semibold text-danger">{what} could not be loaded.</p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}
