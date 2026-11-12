import type { ReactElement, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "../lib/cn";

type ChartContainerProps = {
  /** The conclusion ("R$ 200 abaixo do ritmo"), not a description of the drawing. */
  label: string;
  /** Text or a table, read by screen readers: the keyboard and screen-reader path to the data. */
  alternative: ReactNode;
  /** Gives the chart its height: ResponsiveContainer needs a sized parent. */
  className?: string;
  /** One Recharts chart. Set `accessibilityLayer={false}` on it: a focusable layer cannot live inside role="img". */
  children: ReactElement;
};

/**
 * Colours need no per-theme config: series pass `var(--brand)` and friends, and the tokens swap with
 * data-theme. The alternative sits beside the role="img" div because an img's children are presentational.
 */
export function ChartContainer({ label, alternative, className, children }: ChartContainerProps) {
  return (
    <>
      <div
        role="img"
        aria-label={label}
        className={cn("h-40 w-full text-[11px] tabular-nums [&_.recharts-cartesian-axis-tick_text]:fill-text-muted", className)}
      >
        {/* jsdom measures 0x0, so the initial size keeps the chart in the DOM; browsers replace it on first measure. */}
        <ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>{children}</ResponsiveContainer>
      </div>
      <div className="sr-only">{alternative}</div>
    </>
  );
}

type ChartTooltipContentProps = {
  /** Core never formats money itself: the Finance chart passes `formatAmount`. */
  formatValue: (value: number) => string;
  // Recharts injects these into the content element.
  active?: boolean;
  label?: ReactNode;
  payload?: { value?: unknown; payload?: { why?: string } }[];
};

/** The inverted tooltip: date, amount and, when the data has one, the "why" line. */
export function ChartTooltipContent({ formatValue, active, label, payload }: ChartTooltipContentProps) {
  const item = payload?.[0];
  if (!active || !item || typeof item.value !== "number") return null;
  return (
    <div className="caption rounded-md bg-text p-2 tabular-nums text-bg shadow-(--shadow-overlay)">
      <div>{label}</div>
      <div className="font-semibold">{formatValue(item.value)}</div>
      {item.payload?.why && <div>{item.payload.why}</div>}
    </div>
  );
}

export type { ChartContainerProps, ChartTooltipContentProps };
