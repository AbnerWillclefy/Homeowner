import { cn } from "../lib/cn";

type StepIndicatorProps = {
  /** Required, the whole sentence built by the app ("Passo 2 de 5"): plural and word order are its business. */
  label: string;
  current: number;
  total: number;
  /** The step's name, shown after the label in muted text ("Energia base"). */
  name?: string;
  className?: string;
};

/** Where the person is in a flow of 3 to 7 steps. The text carries the meaning; the segments are decorative. */
export function StepIndicator({ label, current, total, name, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i < current ? "bg-brand" : "bg-surface-sunken")} />
        ))}
      </div>
      <p className="label">
        {label}
        {name && <span className="text-text-muted">{` · ${name}`}</span>}
      </p>
    </div>
  );
}

export type { StepIndicatorProps };
