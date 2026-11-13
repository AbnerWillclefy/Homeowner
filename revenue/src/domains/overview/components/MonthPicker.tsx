import { Button } from "@homeowner/bedrock";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../logic/month";

/** Previous month, the month, next month. The month wraps to its own line when the text is large. */
export function MonthPicker({ month, thisMonth, step }: { month: string; thisMonth: string; step(n: number): void }) {
  const { t, locale } = useI18n();
  return (
    <div role="group" aria-label={t("overview.month.group")} className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="secondary" icon={ChevronLeft} onClick={() => step(-1)}>
        {t("overview.month.prev")}
      </Button>
      <span className="section-title order-first basis-full text-center sm:order-none sm:basis-auto" aria-live="polite">
        {monthLabel(month, locale)}
      </span>
      <Button variant="secondary" disabled={month >= thisMonth} onClick={() => step(1)}>
        {t("overview.month.next")}
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
