import type { ReactNode } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltipContent } from "../components/chart";
import { cn } from "../lib/cn";
import { useMediaQuery } from "../lib/use-media-query";
import { formatAmount } from "./amount";

type Point = { label: string; cents: number; /** Moving average, computed by the app. */ average?: number; /** The tooltip's third line ("Aluguel"). */ why?: string };

type BarChartProps = {
  data: Point[];
  targetCents?: number;
  /** The conclusion, not a description of the drawing. */
  label: string;
  legend: { daily: string; average: string; target: string };
  locale?: string;
  /** A table with the label and the amount, for screen readers. */
  alternative: ReactNode;
  className?: string;
};

export function BarChart({ data, targetCents, label, legend, locale, alternative, className }: BarChartProps) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const swatch = "inline-block shrink-0";
  return (
    <div className="flex flex-col gap-2">
      <ChartContainer label={label} alternative={alternative} className={className}>
        <ComposedChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickCount={3} tickLine={false} axisLine={false} width={48} tickFormatter={(c: number) => formatAmount(c, { locale, precision: "compact" })} />
          <Bar
            dataKey="cents"
            fill="var(--chart-bar)"
            radius={[4, 4, 0, 0]}
            activeBar={{ fill: "var(--text)" }}
            isAnimationActive={!reduced}
            animationDuration={250}
          />
          <Line dataKey="average" type="monotone" stroke="var(--warning)" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={!reduced} animationDuration={250} />
          {targetCents !== undefined && <ReferenceLine y={targetCents} ifOverflow="extendDomain" stroke="var(--text-muted)" strokeDasharray="4 4" />}
          <Tooltip cursor={false} content={<ChartTooltipContent formatValue={(c) => formatAmount(c, { locale })} />} />
        </ComposedChart>
      </ChartContainer>
      <ul className="caption flex flex-wrap gap-x-4 gap-y-1 text-text-muted">
        <li className="flex items-center gap-2">
          <span aria-hidden className={cn(swatch, "size-3 rounded-sm bg-chart-bar")} />
          {legend.daily}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className={cn(swatch, "h-0.5 w-4 bg-warning")} />
          {legend.average}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className={cn(swatch, "w-4 border-t-2 border-dashed border-text-muted")} />
          {legend.target}
        </li>
      </ul>
    </div>
  );
}

export type { BarChartProps };
