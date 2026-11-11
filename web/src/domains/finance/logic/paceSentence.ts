import type { Translate } from "../../../shared/i18n/context";
import { difference } from "./difference";
import { addMonths, monthName, type Month } from "./month";
import type { SameDays } from "./sameDays";
import { formatCents } from "./money";

/**
 * "Até dia 8 você gastou R$ 392,80 a mais que até 8 de Outubro": this month up to `day` against the same days of the
 * previous one, which `sameDays` cut (clamped, so 31 October reads 30 September). Null when there is no cut.
 */
export function paceSentence(
  t: Translate,
  locale: string,
  days: SameDays,
  day: number,
  month: Month,
  /** The usual pace at `day`: cents and how many months it is made of. Left out when there is no history. */
  average?: { cents: number; months: number },
): string | null {
  if (days.cutDay === null) return null;
  const previous = monthName(addMonths(month, -1), locale);
  if (days.noPrevious) return t("finances.spending.noPrevious", { month: previous });
  const gap = difference(days.spent, days.previousSpent);
  const sentence = t(`finances.summary.pace.${gap.key}`, { amount: formatCents(gap.amount, locale), day, cut: days.cutDay, month: previous });
  if (!average || average.months < 1) return sentence;
  const usual = difference(days.spent, average.cents);
  const window = t(average.months === 1 ? "finances.summary.pace.window.one" : "finances.summary.pace.window.other", { n: average.months });
  return `${sentence} ${t(`finances.summary.pace.avg.${usual.key}`, { amount: formatCents(usual.amount, locale), window })}`;
}
