import { Card, CardHeader, CardLabel } from "@homeowner/bedrock";
import { useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useMoney } from "../hooks/useMoney";
import { BAR_WIDTH, chartLayout, PLOT_HEIGHT, PLOT_TOP, shortMonth, STRIDE } from "../logic/chart";

const WIDTH = 12 * STRIDE;
const AXIS = 76;

/**
 * The Leftover of each month as bars: brand when positive, danger when negative, the chosen month in the text colour.
 * A picture for the mouse only: it is `aria-hidden` and its bars are not focusable, because the table under it holds
 * every value and is the keyboard and screen reader way to choose a month.
 */
export function ProjectionChart({ months, leftovers, selected, onSelect }: { months: string[]; leftovers: number[]; selected: string; onSelect: (month: string) => void }) {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const money = useMoney({ precision: "compact" });
  const { bars, baseline, top, bottom } = chartLayout(leftovers);
  const axisY = (v: number, y: number) => <text x={WIDTH + 8} y={y + 4} className="fill-text-muted">{hidden ? "•••" : money(v)}</text>;

  return (
    <Card className="min-w-0 desktop:col-span-8">
      <CardHeader>
        <CardLabel>{t("projection.leftover")}</CardLabel>
      </CardHeader>
      <svg viewBox={`0 0 ${WIDTH + AXIS} ${PLOT_TOP + PLOT_HEIGHT + 32}`} aria-hidden className="w-full text-[11px]">
        <line x1={0} x2={WIDTH} y1={baseline} y2={baseline} className="stroke-border-strong" />
        {top > 0 && axisY(top, PLOT_TOP)}
        {axisY(0, baseline)}
        {bottom < 0 && axisY(bottom, PLOT_TOP + PLOT_HEIGHT)}
        {bars.map((b, i) => (
          <g key={months[i]} onClick={() => onSelect(months[i]!)} className="cursor-pointer">
            <rect x={b.x} y={b.y} width={BAR_WIDTH} height={b.h} rx={4} className={months[i] === selected ? "fill-text" : b.negative ? "fill-danger" : "fill-brand"} />
            <text x={b.x + BAR_WIDTH / 2} y={PLOT_TOP + PLOT_HEIGHT + 24} textAnchor="middle" className="fill-text-muted">{shortMonth(months[i]!, locale)}</text>
          </g>
        ))}
      </svg>
    </Card>
  );
}
