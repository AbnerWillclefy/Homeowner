import { Flame, Pause } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

type StreakProps = Omit<ComponentProps<"button">, "children" | "aria-label"> & {
  days: number;
  /** On a drained day the streak pauses: a pause icon in place of the flame, the number stays. */
  paused?: boolean;
  /** Required: the accessible name, such as "Sequência: 6 dias" or "Sequência pausada: 6 dias". */
  label: string;
};

export function Streak({ days, paused, label, className, type = "button", ...props }: StreakProps) {
  const Icon = paused ? Pause : Flame;
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex h-control-md items-center gap-1 rounded-full border border-border bg-surface pr-4 pl-2 body-strong font-semibold tabular-nums text-text cursor-pointer outline-none touch-target max-tablet:h-control-lg pointer-coarse:h-control-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className={cn("size-4", paused ? "text-text-muted" : "text-warning")} />
      {days}
    </button>
  );
}

export type { StreakProps };
