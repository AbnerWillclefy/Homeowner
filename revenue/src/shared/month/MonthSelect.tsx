import { Select } from "@homeowner/bedrock";
import { CalendarDays } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { addMonths, monthLabel } from "./month";
import { useMonthParam } from "./useMonthParam";

// shortcut: a fixed 12-month window (this month and 11 before), upgrade when Residents need older months in the list.
const WINDOW = 12;

/** The month of the screen, kept in `?month=`. An older month already in the URL is added so an old link still shows. */
export function MonthSelect() {
  const { t, locale } = useI18n();
  const { month, thisMonth, setMonth } = useMonthParam();
  const months = Array.from({ length: WINDOW }, (_, i) => addMonths(thisMonth, -i));
  if (!months.includes(month)) months.push(month);
  return (
    <Select
      label={t("month.select")}
      hideLabel
      icon={CalendarDays}
      value={month}
      onValueChange={setMonth}
      options={months.map((m) => ({ value: m, label: monthLabel(m, locale) }))}
    />
  );
}
