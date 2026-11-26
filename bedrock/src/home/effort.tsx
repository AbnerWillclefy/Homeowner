import { cn } from "../lib/cn";

type EffortProps = {
  /** 1 to 5 lit dots. */
  level: 1 | 2 | 3 | 4 | 5;
  /** The level's name as the Resident reads it, such as "Médio". Always shown. */
  name: string;
  /** Required: the accessible name, such as "Esforço: médio". The dots are decorative. */
  label: string;
  className?: string;
};

export function Effort({ level, name, label, className }: EffortProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 caption text-text-muted", className)}>
      <span aria-hidden className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <i key={n} className={cn("size-1.5 rounded-full", n <= level ? "bg-text" : "bg-border-strong")} />
        ))}
      </span>
      <span aria-hidden>{name}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export type { EffortProps };
