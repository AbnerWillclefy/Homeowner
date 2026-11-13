import { useI18n } from "../../../shared/i18n/I18nProvider";
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
 * and a dashed mark at today. One label on the whole drawing lists the days, so a screen reader hears it once.
 */
export function DueStrip({ bills, month, today }: { bills: Bill[]; month: Month; today: string | null }) {
  const { t } = useI18n();
  const strip = dueStrip(bills, month, today);
  const last = strip.days.length;
  const x = (day: number) => L + ((R - L) * (day - 1)) / (last - 1);
  const due = strip.days.filter((d) => d.bills.length > 0);
  const days = due.length > 0 ? due.map((d) => t(d.bills.length === 1 ? "overview.strip.dayOne" : "overview.strip.dayMany", { day: d.day, count: d.bills.length })).join(" ") : t("overview.strip.none");
  const label = [t("overview.strip.label", { days }), strip.today !== null && t("overview.strip.today", { day: strip.today })].filter(Boolean).join(" ");
  const marks = [1, 15, last];
  return (
    <div className="flex flex-col gap-2">
      <p aria-hidden className="caption flex flex-wrap gap-x-4 text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-text bg-text" />
          {t("overview.strip.paid")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-text bg-surface" />
          {t("overview.strip.unpaid")}
        </span>
      </p>
      <svg role="img" aria-label={label} viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full">
        <line x1={L} x2={R} y1={Y} y2={Y} strokeWidth={1.5} className="stroke-border-strong" />
        {strip.today !== null && <line x1={x(strip.today)} x2={x(strip.today)} y1={Y - 16} y2={Y + 12} strokeWidth={1.5} strokeDasharray="3 3" className="stroke-text" />}
        {due.flatMap((d) =>
          d.bills.map((bill, i) => (
            <circle key={bill.id} cx={x(d.day)} cy={Y - i * 9} r={5} strokeWidth={2} className={`stroke-text ${bill.paid ? "fill-text" : "fill-surface"}`} />
          )),
        )}
        <g fontSize="11" className="fill-text-muted">
          {marks.map((day) => (
            <text key={day} x={x(day)} y={VH - 4} textAnchor="middle">
              {day === strip.today ? t("overview.strip.todayMark") : day}
            </text>
          ))}
          {strip.today !== null && !marks.includes(strip.today) && (
            <text x={x(strip.today)} y={VH - 4} textAnchor="middle" fontWeight={700} className="fill-text">
              {t("overview.strip.todayMark")}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}
