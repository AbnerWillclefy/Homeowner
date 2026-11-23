import { Card, CardLabel, SegmentedControl } from "@homeowner/bedrock";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../../../shared/month/month";
import { useMoney } from "../hooks/useMoney";
import { chartLayout, shortMonth } from "../logic/chart";
import type { Series } from "../logic/projectionRow";

/**
 * The shown Leftover of each month as bars, one series at a time: brand when positive, danger when negative, the
 * chosen month in the text colour. Each bar is a button named with its month and amount (hidden while the toggle is
 * on), so the keyboard and screen readers choose a month here as well as in the list or table.
 */
export function ProjectionChart({ months, values, series, onSeries, selected, onSelect, desktop }: { months: string[]; values: number[]; series: Series; onSeries: (s: Series) => void; selected: string; onSelect: (month: string) => void; desktop: boolean }) {
  const { t, locale } = useI18n();
  const money = useMoney();
  const { bars, rows, empty } = chartLayout(values);
  const grid = "grid grid-flow-col auto-cols-[minmax(0,1fr)] gap-1";

  return (
    <Card variant={desktop ? "default" : "compact"} role="region" aria-labelledby="projection-chart" className="min-w-0 desktop:col-span-8">
      <div className="flex flex-col gap-3 desktop:flex-row desktop:items-center desktop:justify-between">
        <CardLabel id="projection-chart">{t("projection.chart")}</CardLabel>
        <div className="desktop:w-70">
          <SegmentedControl block label={t("projection.mode")} value={series} onValueChange={(s) => onSeries(s as Series)} options={[{ value: "plan", label: t("projection.mode.plan") }, { value: "pace", label: t("projection.mode.pace") }]} />
        </div>
      </div>
      <div className={`${grid} h-40 desktop:h-60`}>
        {bars.map((b, i) => {
          const chosen = months[i] === selected;
          return (
            <button key={months[i]} type="button" aria-pressed={chosen} aria-label={t("projection.barName", { month: monthLabel(months[i]!, locale), amount: money(values[i]!) })} onClick={() => onSelect(months[i]!)} className="grid cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" style={{ gridTemplateRows: rows }}>
              <span className="flex flex-col justify-end">
                {b.up !== null && <span className={`block min-h-0.5 w-full rounded-t-sm ${chosen ? "bg-text" : "bg-brand"}`} style={{ height: `${b.up}%` }} />}
              </span>
              <span className={`flex flex-col justify-start ${empty ? "" : "border-t border-chart-grid"}`}>
                {b.down !== null && <span className={`block min-h-0.5 w-full rounded-b-sm bg-danger ${chosen ? "outline-2 outline-offset-1 outline-text" : ""}`} style={{ height: `${b.down}%` }} />}
              </span>
            </button>
          );
        })}
      </div>
      <div aria-hidden className={`${grid} text-center text-[0.6875rem] leading-4 text-text-muted`}>
        {months.map((m) => <span key={m} className="truncate">{shortMonth(m, locale)}</span>)}
      </div>
      <span className="caption text-text-muted">{desktop ? t("projection.chartNote") : t("projection.chartNote.phone")}</span>
    </Card>
  );
}
