import type { ReactNode } from "react";
import { Progress } from "radix-ui";
import { cn } from "../lib/cn";

/** Warning from 85% up to and including 100%; danger past it. */
export function progressTone(value: number, max: number): "brand" | "warning" | "danger" {
  const ratio = value / max;
  return ratio > 1 ? "danger" : ratio >= 0.85 ? "warning" : "brand";
}

const toneClass = { brand: "bg-brand", warning: "bg-warning", danger: "bg-danger" };

export type ProgressBarProps = {
  value: number;
  /** Must be above 0, as Radix requires. */
  max: number;
  /** The accessible name. */
  label: string;
  /** The spoken value, written by the app, for example "R$ 1.640 de R$ 2.000". */
  valueText?: string;
  /** Meta row left and right; the app passes Amount, so money is never formatted here. */
  start?: ReactNode;
  end?: ReactNode;
};

export function ProgressBar({ value, max, label, valueText, start, end }: ProgressBarProps) {
  // Radix treats value > max as invalid and drops aria-valuenow, so it gets the capped value.
  const shown = Math.min(value, max);
  return (
    <div className="flex flex-col gap-2">
      <Progress.Root
        value={shown}
        max={max}
        aria-label={label}
        aria-valuetext={valueText}
        className="relative h-2 overflow-hidden rounded-full bg-surface-sunken"
      >
        <Progress.Indicator
          className={cn(
            "size-full motion-safe:transition-transform duration-(--duration-slow) ease-standard",
            toneClass[progressTone(value, max)],
          )}
          style={{ transform: `translateX(-${100 - (shown / max) * 100}%)` }}
        />
      </Progress.Root>
      {(start || end) && (
        <div className="flex justify-between gap-4 caption">
          <span className="text-text">{start}</span>
          <span className="text-text-muted">{end}</span>
        </div>
      )}
    </div>
  );
}
