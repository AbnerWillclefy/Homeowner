import { useI18n } from "../../../shared/i18n";
import type { Bill } from "../api/api";
import { dueStrip } from "../logic/dueStrip";
import type { Month } from "../logic/month";

/**
 * The month's days in a wrapping grid, with the count of Bills due under each day. Today is outlined (a shape, not a
 * colour). One label on the whole strip lists the days and the count, so a screen reader hears it once, not 31 cells.
 */
export function DueStrip({ bills, month, today }: { bills: Bill[]; month: Month; today: string | null }) {
  const { t } = useI18n();
  const strip = dueStrip(bills, month, today);
  const due = strip.days.filter((d) => d.bills.length > 0);
  const days = due.length > 0 ? due.map((d) => t("finances.bills.strip.day", { day: d.day, count: d.bills.length })).join(" ") : t("finances.bills.strip.none");
  const label = [t("finances.bills.strip.label", { days }), strip.today !== null && t("finances.bills.strip.today", { day: strip.today })].filter(Boolean).join(" ");
  return (
    <div
      role="img"
      aria-label={label}
      className="grid gap-1 overflow-x-auto"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(2.25rem, 1fr))" }}
    >
      {strip.days.map((d) => (
        <div
          key={d.day}
          aria-hidden="true"
          data-today={d.day === strip.today ? "" : undefined}
          className={`box-border flex min-h-11 flex-col items-center justify-center rounded-control border text-sm ${
            d.day === strip.today ? "border-2 border-text font-bold" : "border-border"
          } ${d.bills.length > 0 ? "bg-surface-raised" : "text-muted"}`}
        >
          <span>{d.day}</span>
          <span className="font-bold">{d.bills.length > 0 ? d.bills.length : " "}</span>
        </div>
      ))}
    </div>
  );
}
