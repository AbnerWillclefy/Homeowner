import { useId } from "react";
import { RANGES, type Range } from "./range";

const LABELS: Record<Range, string> = { "7d": "7 days", "30d": "30 days" };

/**
 * A two-option segmented control: radio inputs in a fieldset, so the arrow keys move between them. The selected
 * one is bold with a heavier border and a check mark as well as the accent fill, so colour is never the only cue.
 */
export function RangeControl({ value, onChange }: { value: Range; onChange(range: Range): void }) {
  const name = useId();
  return (
    <fieldset className="m-0 inline-flex items-center gap-3 border-0 p-0">
      <legend className="float-left mr-3 p-0 font-semibold">Range</legend>
      <div className="inline-flex">
        {RANGES.map((range) => {
          const selected = range === value;
          return (
            <label
              key={range}
              className={`m-0 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center border px-4 first:rounded-l-control last:rounded-r-control has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
                selected
                  ? "border-2 border-accent bg-accent font-bold text-accent-contrast"
                  : "border-border bg-surface-raised font-normal text-text"
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
