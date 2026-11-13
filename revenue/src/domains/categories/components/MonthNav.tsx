import { Button } from "@homeowner/bedrock";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../logic/month";

export function MonthNav({ month, thisMonth, step }: { month: string; thisMonth: string; step(n: number): void }) {
  const { t, locale } = useI18n();
  return (
    <div role="group" aria-label={t("categories.month.group")} className="flex items-center justify-between gap-2">
      <Button variant="secondary" icon={ChevronLeft} onClick={() => step(-1)}>
        <span className="sr-only">{t("categories.month.prev")}</span>
      </Button>
      <p className="body-strong text-center" aria-live="polite">{monthLabel(month, locale)}</p>
      <Button variant="secondary" icon={ChevronRight} disabled={month >= thisMonth} onClick={() => step(1)}>
        <span className="sr-only">{t("categories.month.next")}</span>
      </Button>
    </div>
  );
}
