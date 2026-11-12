import type { ReactNode } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltipContent } from "../components/chart";
import { formatAmount } from "./amount";

type Point = { day: number; cents: number };

type PaceChartProps = {
  /** Days in the month. */
  days: number;
  limitCents: number;
  /** Cumulative spending, one point per day up to today. */
  spent: Point[];
  /** The conclusion ("R$ 200 abaixo do ritmo"). */
  label: string;
  /** The marker text ("R$ 200 abaixo"); its wording, not its colour, says under or over. */
  markerLabel: string;
  variant?: "default" | "hero";
  /** Day and amount axes. Never on the hero card. */
  axes?: boolean;
  locale?: string;
  /** A table with the day and the amount, for screen readers. */
  alternative: ReactNode;
  className?: string;
};

/** Over pace is strictly above the line: spending exactly on pace is not over. */
export function isOverPace(last: Point, limitCents: number, days: number): boolean {
  return last.cents > (limitCents * last.day) / days;
}

const MARKER_HEIGHT = 20;

function Marker({ text, fill, viewBox }: { text: string; fill: string; viewBox?: { cx?: number; cy?: number } }) {
  const { cx = 0, cy = 0 } = viewBox ?? {};
  // A solid Badge drawn in SVG, right-aligned to the point so it never clips at the edge. 6.5px per character is an estimate.
  const width = text.length * 6.5 + 16;
  return (
    <g>
      <rect x={cx - width} y={cy - MARKER_HEIGHT - 8} width={width} height={MARKER_HEIGHT} rx={MARKER_HEIGHT / 2} fill={fill} />
      <text
        x={cx - width / 2}
        y={cy - MARKER_HEIGHT / 2 - 8}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
        fill="var(--on-brand)"
      >
        {text}
      </text>
    </g>
  );
}

export function PaceChart({
  days,
  limitCents,
  spent,
  label,
  markerLabel,
  variant = "default",
  axes = false,
  locale,
  alternative,
  className,
}: PaceChartProps) {
  const hero = variant === "hero";
  const showAxes = axes && !hero;
  const line = hero ? "var(--hero-line)" : "var(--brand)";
  const last = spent.at(-1);
  const over = last ? isOverPace(last, limitCents, days) : false;
  const top = Math.max(limitCents, last?.cents ?? 0);

  return (
    <ChartContainer label={label} alternative={alternative} className={className}>
      <ComposedChart accessibilityLayer={false} data={spent} margin={{ top: 28, right: 8, bottom: 0, left: showAxes ? 0 : 8 }}>
        {showAxes && <CartesianGrid vertical={false} stroke="var(--chart-grid)" />}
        <XAxis dataKey="day" type="number" domain={[1, days]} hide={!showAxes} tickLine={false} axisLine={false} />
        <YAxis
          type="number"
          domain={[0, top]}
          hide={!showAxes}
          tickCount={3}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(c: number) => formatAmount(c, { locale, precision: "compact" })}
        />
        <ReferenceLine
          segment={[
            { x: 1, y: 0 },
            { x: days, y: limitCents },
          ]}
          stroke={hero ? "var(--on-hero-muted)" : "var(--text-muted)"}
          strokeDasharray="4 4"
        />
        <Area dataKey="cents" type="monotone" stroke="none" fill={line} fillOpacity={0.12} dot={false} activeDot={false} />
        <Line dataKey="cents" type="monotone" stroke={line} strokeWidth={2.5} dot={false} activeDot={false} />
        {last && (
          <ReferenceDot
            x={last.day}
            y={last.cents}
            r={5}
            fill={hero ? "var(--hero)" : "var(--surface)"}
            stroke={line}
            strokeWidth={2.5}
            label={(p: { viewBox?: { cx?: number; cy?: number } }) => (
              <Marker text={markerLabel} fill={over ? "var(--warning)" : "var(--positive)"} viewBox={p.viewBox} />
            )}
          />
        )}
        <Tooltip content={<ChartTooltipContent formatValue={(c) => formatAmount(c, { locale })} />} />
      </ComposedChart>
    </ChartContainer>
  );
}

export type { PaceChartProps };
