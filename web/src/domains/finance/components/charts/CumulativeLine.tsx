import { useState } from "react";
import { useI18n } from "../../../../shared/i18n";
import { Button } from "../../../../shared/ui/Button";
import { barPercent, linePoints, scaleMax } from "../../logic/chart";
import { formatCents } from "../../logic/money";

export interface LineSeries {
  label: string;
  /** Cumulative cents per day, day 1 first. */
  points: number[];
}

// The drawing area inside a 342 x 150 viewBox: room on the left for the scale and below for the days.
const VW = 342;
const VH = 150;
const L = 36;
const R = 334;
const T = 12;
const B = 130;
// Dashes, not colour, tell the series apart: solid, dashed, dotted.
const DASH = [undefined, "4 3", "1.5 4"];
const dash = (index: number) => DASH[Math.min(index, DASH.length - 1)];
const last = (points: number[]) => points[points.length - 1] ?? 0;

/**
 * Cumulative spending, one line per series on a shared scale, with the legend and each series' final amount above it.
 * The SVG has the same as a text summary, and a link swaps it for a table of the same numbers.
 */
export function CumulativeLine({ title, series }: { title: string; series: LineSeries[] }) {
  const { t, locale } = useI18n();
  const [table, setTable] = useState(false);
  const money = (cents: number) => formatCents(cents, locale);
  const compact = (cents: number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
  const max = scaleMax(series.flatMap((s) => s.points), []);
  const days = Math.max(0, ...series.map((s) => s.points.length));
  const finals = series.map((s) => t("charts.line.final", { series: s.label, amount: money(last(s.points)) }));
  const x = (day: number) => L + (days > 1 ? ((R - L) * day) / (days - 1) : 0);
  const y = (cents: number) => B - ((B - T) * barPercent(cents, max)) / 100;
  // The first series stops at today in the running month: a dot and its amount mark where it ends.
  const current = series[0]?.points ?? [];
  const today = current.length > 0 && current.length < days ? current.length - 1 : null;

  return (
    <div className="flex flex-col gap-3">
      <ul aria-label={title} className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm font-semibold text-muted">
        {series.map((s, index) => (
          <li key={s.label} className="inline-flex flex-wrap items-center gap-x-1.5">
            <svg aria-hidden="true" viewBox="0 0 20 4" className="h-1 w-5 shrink-0 overflow-visible">
              <line
                x1="0"
                x2="20"
                y1="2"
                y2="2"
                strokeWidth={index === 0 ? 2.5 : 2}
                strokeDasharray={dash(index)}
                className={`${index === 0 ? "stroke-chart-ink" : "stroke-chart-muted"} forced-colors:stroke-current`}
              />
            </svg>
            {s.label}
            <span className="text-text">{money(last(s.points))}</span>
          </li>
        ))}
      </ul>
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
        <svg role="img" aria-label={`${title}. ${finals.join("; ")}`} viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full overflow-visible">
          <g aria-hidden="true" fontSize="11" className="fill-muted">
            <line x1={L} x2={R} y1={B} y2={B} className="stroke-chart-muted" strokeWidth={1} />
            {[0.5, 1].map((share) => (
              <line key={share} x1={L} x2={R} y1={B - (B - T) * share} y2={B - (B - T) * share} className="stroke-chart-track" strokeWidth={1} />
            ))}
            {[0, 0.5, 1].map((share) => (
              <text key={share} x={L - 6} y={B - (B - T) * share + 4} textAnchor="end">
                {compact(max * share)}
              </text>
            ))}
            {days > 1 &&
              [1, Math.min(15, days), days].map((day) => (
                <text key={day} x={x(day - 1)} y={VH - 4} textAnchor="middle">
                  {day}
                </text>
              ))}
          </g>
          {today !== null && <line x1={x(today)} x2={x(today)} y1={T} y2={B} className="stroke-chart-muted" strokeWidth={1} strokeDasharray="2 3" />}
          {series.map((s, index) => (
            <polyline
              key={s.label}
              transform={`translate(${L} ${T})`}
              points={linePoints(s.points, max, R - L, B - T, days)}
              fill="none"
              strokeWidth={index === 0 ? 2.5 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={dash(index)}
              className={`${index === 0 ? "stroke-chart-ink" : "stroke-chart-muted"} forced-colors:stroke-current`}
            />
          ))}
          {today !== null && (
            <g aria-hidden="true">
              <circle cx={x(today)} cy={y(current[today]!)} r={5} strokeWidth={2} className="fill-chart-ink stroke-surface-raised" />
              <text
                x={x(today) + (today > days / 2 ? -8 : 8)}
                y={y(current[today]!) - 6}
                textAnchor={today > days / 2 ? "end" : "start"}
                fontSize="12"
                fontWeight="700"
                className="fill-text"
              >
                {t("charts.line.today", { amount: money(current[today]!) })}
              </text>
            </g>
          )}
        </svg>
      )}
      <Button variant="link" className="self-end text-sm" onClick={() => setTable((value) => !value)}>
        {t(table ? "charts.view.chart" : "charts.view.table")}
      </Button>
    </div>
  );
}
