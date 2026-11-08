import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { monthLabel, type Month } from "../logic/month";

interface Props {
  month: Month;
  /** The current month: the picker never goes past it. */
  today: Month;
  groupLabel: string;
  prevLabel: string;
  nextLabel: string;
  onStep: (n: number) => void;
}

export function MonthPicker({ month, today, groupLabel, prevLabel, nextLabel, onStep }: Props) {
  const { locale } = useI18n();
  return (
    // The month on its own line, so the two buttons never squeeze it into one letter per line.
    <div role="group" aria-label={groupLabel} className="flex flex-col gap-2">
      <span className="text-center font-semibold capitalize [overflow-wrap:anywhere]" aria-live="polite">
        {monthLabel(month, locale)}
      </span>
      <div className="flex items-center justify-between gap-2">
        <Button icon variant="secondary" aria-label={prevLabel} onClick={() => onStep(-1)}>
          <ChevronLeft aria-hidden="true" size={20} />
        </Button>
        <Button icon variant="secondary" aria-label={nextLabel} disabled={month >= today} onClick={() => onStep(1)}>
          <ChevronRight aria-hidden="true" size={20} />
        </Button>
      </div>
    </div>
  );
}
