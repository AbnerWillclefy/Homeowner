import type { Translate } from "../../../shared/i18n";
import { formatDay } from "./format";

/** The day before a "YYYY-MM-DD" one. A calendar date, so no zone shifts it. */
function dayBefore(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * "Hoje", "Ontem" or the day, then who did it: "Ontem, Ana". The names are those the Shell knows; with none
 * (they left, or the list has not loaded) it is the day alone.
 */
export function lastDoneText(t: Translate, locale: string, today: string, date: string, names: string[]): string {
  const when = date === today ? t("dayplan.task.sheet.last.today") : date === dayBefore(today) ? t("dayplan.task.sheet.last.yesterday") : formatDay(date, locale);
  return names.length > 0 ? t("dayplan.task.sheet.last", { when, name: names.join(", ") }) : when;
}
