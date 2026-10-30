import { Line, LineChart, ReferenceLine, YAxis } from "recharts";

const WIDTH = 160;
const HEIGHT = 36;

/**
 * A small trend line. A `null` day breaks the line, a day alone between gaps gets a dot, and an all-zero series sits
 * on the baseline (the top is at least 1). `label` is the text alternative; the chart inside is decorative.
 */
export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const data = values.map((value, day) => ({ day, value }));
  const lone = (day: number) => values[day] !== null && (values[day - 1] ?? null) === null && (values[day + 1] ?? null) === null;
  return (
    <div role="img" aria-label={label} className="mt-2" style={{ width: WIDTH, height: HEIGHT }}>
      <LineChart width={WIDTH} height={HEIGHT} data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }} accessibilityLayer={false}>
        <YAxis hide domain={[0, (top: number) => Math.max(1, top)]} />
        <ReferenceLine y={0} stroke="var(--color-border)" strokeOpacity={0.5} />
        <Line
          dataKey="value"
          stroke="var(--color-accent)"
          strokeWidth={2}
          connectNulls={false}
          isAnimationActive={false}
          dot={({ cx, cy, index }: { cx?: number; cy?: number; index: number }) =>
            lone(index) ? <circle key={index} data-lone-day="" cx={cx} cy={cy} r={2.5} fill="var(--color-accent)" /> : <g key={index} />
          }
        />
      </LineChart>
    </div>
  );
}
