import { useId } from "react";
import { RANGES, type Range } from "./range";

const LABELS: Record<Range, string> = { "7d": "7 days", "30d": "30 days" };

/**
 * A two-option segmented control: radio inputs in a fieldset, so the arrow keys move between them. The selected
 * one is bold with a check mark as well as the accent fill, so colour is never the only cue.
 */
export function RangeControl({ value, onChange }: { value: Range; onChange(range: Range): void }) {
  const name = useId();
  return (
    <fieldset className="m-0 inline-flex items-center gap-3 border-0 p-0">
      <legend className="float-left mr-3 p-0 text-sm text-muted">Range</legend>
      <div className="inline-flex rounded-control border border-border bg-surface-raised p-0.5">
        {RANGES.map((range) => {
          const selected = range === value;
          return (
            <label
              key={range}
              className={`m-0 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-2px)] px-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
                selected ? "bg-accent font-bold text-accent-contrast" : "font-normal text-muted hover:text-text"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={range}
                checked={selected}
                onChange={() => onChange(range)}
                className="sr-only"
              />
              {selected && <span aria-hidden="true">{"✓ "}</span>}
              {LABELS[range]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
