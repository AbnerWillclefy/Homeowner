import { useState } from "react";
import { useI18n } from "../../../../shared/i18n";
import { Button } from "../../../../shared/ui/Button";
import { linePoints, scaleMax } from "../../logic/chart";
import { formatCents } from "../../logic/money";

export interface LineSeries {
  label: string;
  /** Cumulative cents per day, day 1 first. */
  points: number[];
}

const W = 100;
const H = 40;
// Dashes, not colour, tell the series apart: solid, dashed, dotted.
const DASH = [undefined, "6 4", "1.5 4"];
const dash = (index: number) => DASH[Math.min(index, DASH.length - 1)];
const last = (points: number[]) => points[points.length - 1] ?? 0;

/**
 * Cumulative spending, one line per series on a shared scale. Each series' final amount is text under the chart,
 * the SVG has a text summary, and a toggle swaps it for a table of the same numbers.
 */
export function CumulativeLine({ title, series }: { title: string; series: LineSeries[] }) {
  const { t, locale } = useI18n();
  const [table, setTable] = useState(false);
  const money = (cents: number) => formatCents(cents, locale);
  const max = scaleMax(series.flatMap((s) => s.points), []);
  const days = Math.max(0, ...series.map((s) => s.points.length));
  const finals = series.map((s) => t("charts.line.final", { series: s.label, amount: money(last(s.points)) }));

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 font-semibold [overflow-wrap:anywhere]">{title}</p>
      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-start text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-border p-2 text-start">
                  {t("charts.table.day")}
                </th>
                {series.map((s) => (
                  <th key={s.label} scope="col" className="border-b border-border p-2 text-start [overflow-wrap:anywhere]">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: days }, (_, day) => (
                <tr key={day}>
                  <th scope="row" className="border-b border-border p-2 text-start font-normal">
                    {day + 1}
                  </th>
                  {series.map((s) => (
                    <td key={s.label} className="border-b border-border p-2">
                      {s.points[day] === undefined ? "–" : money(s.points[day])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          role="img"
          aria-label={`${title}. ${finals.join("; ")}`}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-32 w-full overflow-visible border-b border-s border-border"
        >
          {series.map((s, index) => (
            <polyline
              key={s.label}
              points={linePoints(s.points, max, W, H, days)}
              fill="none"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeDasharray={dash(index)}
              vectorEffect="non-scaling-stroke"
              className={`${index === 0 ? "stroke-chart-ink" : "stroke-chart-muted"} forced-colors:stroke-current`}
            />
          ))}
        </svg>
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {series.map((s, index) => (
          <li key={s.label} className="flex items-start gap-3">
            <svg aria-hidden="true" viewBox="0 0 24 4" className="mt-3 h-1 w-6 shrink-0 overflow-visible">
              <line
                x1="0"
                x2="24"
                y1="2"
                y2="2"
                strokeWidth={2.5}
                strokeDasharray={dash(index)}
                className={`${index === 0 ? "stroke-chart-ink" : "stroke-chart-muted"} forced-colors:stroke-current`}
              />
            </svg>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm text-muted [overflow-wrap:anywhere]">{s.label}</span>
              <span className="text-lg font-bold [overflow-wrap:anywhere]">{money(last(s.points))}</span>
            </span>
          </li>
        ))}
      </ul>
      <Button variant="secondary" onClick={() => setTable((value) => !value)}>
        {t(table ? "charts.view.chart" : "charts.view.table")}
      </Button>
    </div>
  );
}
