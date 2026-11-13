import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Bill } from "../api/api";
import { dueStrip } from "../logic/dueStrip";
import type { Month } from "../logic/month";

/** The line's distance from the top, in px; dots stack upward from it. */
const Y = 22;

/**
 * The month as a line with a dot on each Bill's due day: filled when paid, hollow when not (a shape, not a colour),
 * and a dashed mark at today. One label on the whole drawing lists the days, so a screen reader hears it once.
 * Drawn in HTML at percentage positions, so the line stretches with the card while dots and labels keep their size.
 */
export function DueStrip({ bills, month, today }: { bills: Bill[]; month: Month; today: string | null }) {
  const { t } = useI18n();
  const strip = dueStrip(bills, month, today);
  const last = strip.days.length;
  const x = (day: number) => `${(100 * (day - 1)) / (last - 1)}%`;
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
      <div role="img" aria-label={label} className="relative mx-2 h-14">
        <div className="absolute inset-x-0 h-0.5 -translate-y-1/2 bg-border-strong" style={{ top: Y }} />
        {strip.today !== null && <div className="absolute h-7 -translate-x-1/2 border-l-2 border-dashed border-text" style={{ left: x(strip.today), top: Y - 16 }} />}
        {due.flatMap((d) =>
          d.bills.map((bill, i) => (
            <span
              key={bill.id}
              className={`absolute size-3 -translate-1/2 rounded-full border-2 border-text ${bill.paid ? "bg-text" : "bg-surface"}`}
              style={{ left: x(d.day), top: Y - i * 9 }}
            />
          )),
        )}
        {marks.map((day) => (
          <span key={day} className={`caption absolute bottom-0 -translate-x-1/2 ${day === strip.today ? "font-bold text-text" : "text-text-muted"}`} style={{ left: x(day) }}>
            {day === strip.today ? t("overview.strip.todayMark") : day}
          </span>
        ))}
        {strip.today !== null && !marks.includes(strip.today) && (
          <span className="caption absolute bottom-0 -translate-x-1/2 font-bold text-text" style={{ left: x(strip.today) }}>
            {t("overview.strip.todayMark")}
          </span>
        )}
      </div>
    </div>
  );
}
