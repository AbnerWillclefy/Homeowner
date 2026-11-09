import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useFinanceMonth } from "../hooks/useFinanceMonth";
import { monthLabel } from "../logic/month";

/**
 * Previous month, the month, next month, on one row; where the row is narrow (the largest text) the month moves to a
 * line of its own above the buttons, so it is never squeezed to one letter per line.
 */
export function MonthPicker({ groupLabel }: { groupLabel: string }) {
  const { t, locale } = useI18n();
  const { month, thisMonth, step } = useFinanceMonth();
  return (
    <div role="group" aria-label={groupLabel} className="@container">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button icon variant="secondary" aria-label={t("finances.month.prev")} onClick={() => step(-1)}>
          <ChevronLeft aria-hidden="true" size={20} />
        </Button>
        <span className="order-first basis-full text-center text-lg font-bold @[16rem]:order-none @[16rem]:basis-0 @[16rem]:flex-1" aria-live="polite">
          {monthLabel(month, locale)}
        </span>
        <Button icon variant="secondary" aria-label={t("finances.month.next")} disabled={month >= thisMonth} onClick={() => step(1)}>
          <ChevronRight aria-hidden="true" size={20} />
        </Button>
      </div>
    </div>
  );
}
