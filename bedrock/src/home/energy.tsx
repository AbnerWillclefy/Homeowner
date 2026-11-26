import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

type EnergyLevel = 0 | 1 | 2 | 3 | 4;

/** Four bars, `level` of them lit. Decorative: the level's name is always written beside it. */
export function EnergyBars({ level, onHero }: { level: EnergyLevel; onHero?: boolean }) {
  return (
    <span aria-hidden className="inline-flex h-4 items-end gap-0.5 px-1">
      {(["h-1", "h-2", "h-3", "h-4"] as const).map((h, i) => (
        <i
          key={h}
          className={cn(
            "w-1 rounded-[1px]",
            h,
            i < level ? (onHero ? "bg-hero-line" : "bg-brand") : onHero ? "bg-on-hero-muted opacity-40" : "bg-border-strong",
          )}
        />
      ))}
    </span>
  );
}

type EnergyProps = Omit<ComponentProps<"button">, "children" | "aria-label"> & {
  level: EnergyLevel;
  /** The level's name as the Resident reads it, such as "Normal". Always shown. */
  name: string;
  /** Required: the button's accessible name, such as "Energia: normal. Mudar". */
  label: string;
  /** Lit bars use the hero card's line colour. */
  onHero?: boolean;
};

/** The day's energy as a chip that opens the check-in. Esgotado is never red: resting is not an error. */
export function Energy({ level, name, label, onHero, className, type = "button", ...props }: EnergyProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex h-control-md items-center gap-2 rounded-full border border-border bg-surface pr-4 pl-2 body-strong text-text cursor-pointer outline-none touch-target max-tablet:h-control-lg pointer-coarse:h-control-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
      {...props}
    >
      <EnergyBars level={level} onHero={onHero} />
      {name}
    </button>
  );
}

export type { EnergyLevel, EnergyProps };
