import type { Range } from "./range";
import { RangeControl } from "./RangeControl";

/** Every page's top: its title, one line on what it answers, and the range control. */
export function PageHeader({ title, note, range, onRange }: { title: string; note: string; range: Range; onRange(range: Range): void }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/50 pb-4">
      <div>
        <h1>{title}</h1>
        <p className="m-0 mt-1 text-sm text-muted">{note}</p>
      </div>
      <RangeControl value={range} onChange={onRange} />
    </div>
  );
}
