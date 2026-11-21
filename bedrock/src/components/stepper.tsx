import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { cn } from "../lib/cn";

type StepperProps = {
  /** Required: what is counted ("Quantity of Rice"); the buttons and the value are named from it. */
  label: string;
  decrementLabel: string;
  incrementLabel: string;
  value: number;
  onValueChange: (value: number) => void;
  /** The smallest value; the minus button is aria-disabled there (it keeps focus). Default: one step. */
  min?: number;
  max?: number;
  /** Default 1. Use 0.001 for kilograms. */
  step?: number;
  /** Formats the shown value, for example `1,234 kg`. Default: the number as is. */
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
};

// Rounds away float noise so 1.1 + 0.1 shows 1.2, not 1.2000000000000002.
const round = (n: number) => Number(n.toFixed(10));

const button =
  "touch-target inline-grid size-control-md shrink-0 cursor-pointer place-items-center rounded-full border border-border bg-surface text-text outline-none motion-safe:transition-colors duration-(--duration-fast) hover:bg-surface-hover active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled) aria-disabled:cursor-not-allowed aria-disabled:opacity-(--opacity-disabled)";

export function Stepper({ label, decrementLabel, incrementLabel, value, onValueChange, min, max, step = 1, format, disabled, className }: StepperProps) {
  const id = useId();
  const floor = min ?? step;
  const atMin = value - step < floor - step / 2;
  const atMax = max !== undefined && value + step > max + step / 2;
  return (
    <div role="group" aria-labelledby={id} className={cn("inline-flex items-center gap-2", className)}>
      <span id={id} className="sr-only">
        {label}
      </span>
      <button type="button" className={button} aria-label={decrementLabel} disabled={disabled} aria-disabled={atMin || undefined} onClick={() => !atMin && onValueChange(round(value - step))}>
        <Minus className="size-4" aria-hidden="true" />
      </button>
      {/* role=status announces the new value after each press */}
      <output role="status" className="body-strong min-w-12 text-center tabular-nums">
        {format ? format(value) : value}
      </output>
      <button type="button" className={button} aria-label={incrementLabel} disabled={disabled} aria-disabled={atMax || undefined} onClick={() => !atMax && onValueChange(round(value + step))}>
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export type { StepperProps };
