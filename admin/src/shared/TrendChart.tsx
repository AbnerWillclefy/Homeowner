import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendSeries {
  label: string;
  values: number[];
}

// Each series differs by line style as well as colour, so the chart reads without colour. One style per series.
const STYLES = [
  { stroke: "var(--color-accent)", dash: undefined, swatch: "border-solid border-accent" },
  { stroke: "var(--color-text)", dash: "6 4", swatch: "border-dashed border-text" },
  { stroke: "var(--color-muted)", dash: "2 3", swatch: "border-dotted border-muted" },
];

/** The chart's text alternative: each series' total and its highest day. */
export function trendLabel(title: string, dates: string[], series: TrendSeries[]): string {
  const parts = series.map(({ label, values }) => {
    const total = values.reduce((sum, v) => sum + v, 0);
    if (total === 0) return `${label}: none.`;
    const top = Math.max(...values);
    return `${label}: ${total} in total, highest ${top} on ${dates[values.indexOf(top)]}.`;
  });
  return `${title}, last ${dates.length} days. ${parts.join(" ")}`;
}

/**
 * Daily counts as lines, sized to its container. The summary is the text alternative; the page keeps the full numbers
 * in a table next to it.
 */
export function TrendChart({ title, dates, series }: { title: string; dates: string[]; series: TrendSeries[] }) {
  if (series.length > STYLES.length) throw new Error(`TrendChart draws at most ${STYLES.length} series, got ${series.length}`);
  const styled = series.map((s, i) => ({ ...s, style: STYLES[i]! }));
  const data = dates.map((date, day) => ({ date: date.slice(5), ...Object.fromEntries(series.map((s) => [s.label, s.values[day]])) }));
  return (
    <figure className="m-0 mb-3 rounded-card border border-border/50 bg-surface-raised p-4">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-muted">
        {styled.map(({ label, style }) => (
          <li key={label} className="m-0 inline-flex items-center gap-2">
            <span aria-hidden="true" className={`inline-block w-5 border-t-2 ${style.swatch}`} />
            {label}
          </li>
        ))}
      </ul>
      <div role="img" aria-label={trendLabel(title, dates, series)} className="mt-3 h-56 w-full">
        {/* Off: the wrapper is the image, so the svg must not be a keyboard stop that announces nothing. */}
        <LineChart responsive accessibilityLayer={false} data={data} style={{ width: "100%", height: "100%" }} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.35} />
          <XAxis dataKey="date" tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} minTickGap={16} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", borderRadius: 6, color: "var(--color-text)" }}
            labelStyle={{ color: "var(--color-muted)" }}
          />
          {styled.map(({ label, style }) => (
            <Line
              key={label}
              dataKey={label}
              stroke={style.stroke}
              strokeDasharray={style.dash}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </div>
    </figure>
  );
}
