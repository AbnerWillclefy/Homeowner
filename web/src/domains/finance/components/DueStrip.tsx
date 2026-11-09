import { useI18n } from "../../../shared/i18n";
import type { Bill } from "../api/api";
import { dueStrip } from "../logic/dueStrip";
import type { Month } from "../logic/month";

const VW = 300;
const VH = 56;
const L = 8;
const R = 292;
const Y = 22;

/**
 * The month as a line with a dot on each Bill's due day: filled when paid, hollow when not (a shape, not a colour),
 * and a dashed mark at today. Bills on one day stack. One label on the whole drawing lists the days and the count,
 * so a screen reader hears it once.
 */
export function DueStrip({ bills, month, today }: { bills: Bill[]; month: Month; today: string | null }) {
  const { t } = useI18n();
  const strip = dueStrip(bills, month, today);
  const last = strip.days.length;
  const x = (day: number) => L + ((R - L) * (day - 1)) / (last - 1);
  const due = strip.days.filter((d) => d.bills.length > 0);
  const days = due.length > 0 ? due.map((d) => t("finances.bills.strip.day", { day: d.day, count: d.bills.length })).join(" ") : t("finances.bills.strip.none");
  const label = [t("finances.bills.strip.label", { days }), strip.today !== null && t("finances.bills.strip.today", { day: strip.today })].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-2">
      <p aria-hidden="true" className="m-0 flex flex-wrap gap-x-4 text-sm font-semibold text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-chart-ink bg-chart-ink" />
          {t("finances.bills.strip.paid")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-chart-ink bg-surface-raised" />
          {t("finances.bills.strip.unpaid")}
        </span>
      </p>
      <svg role="img" aria-label={label} viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full">
        <line x1={L} x2={R} y1={Y} y2={Y} strokeWidth={1.5} className="stroke-chart-muted" />
        {strip.today !== null && <line x1={x(strip.today)} x2={x(strip.today)} y1={Y - 16} y2={Y + 12} strokeWidth={1.5} strokeDasharray="3 3" className="stroke-chart-ink" />}
        {due.flatMap((d) =>
          d.bills.map((bill, i) => (
            <circle
              key={bill.id}
              data-paid={bill.paid ? "" : undefined}
              cx={x(d.day)}
              cy={Y - i * 9}
              r={5}
              strokeWidth={2}
              className={`stroke-chart-ink ${bill.paid ? "fill-chart-ink" : "fill-surface-raised"} forced-colors:stroke-current`}
            />
          )),
        )}
        <g fontSize="11" className="fill-muted">
          {[1, 15, last].map((day) => (
            <text key={day} x={x(day)} y={VH - 4} textAnchor="middle" fontWeight={day === strip.today ? 700 : undefined}>
              {day === strip.today ? t("finances.bills.strip.todayMark") : day}
            </text>
          ))}
          {strip.today !== null && ![1, 15, last].includes(strip.today) && (
            <text x={x(strip.today)} y={VH - 4} textAnchor="middle" fontWeight={700} className="fill-text">
              {t("finances.bills.strip.todayMark")}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}
