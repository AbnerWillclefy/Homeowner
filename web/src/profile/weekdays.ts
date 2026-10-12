import type { Weekday } from "./api";
import type { Locale } from "../shared/i18n";

/** The ISO week the screen shows, Monday first. The API's own order starts on Sunday. */
export const DISPLAY_WEEKDAYS: readonly Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// 2024-01-01 was a Monday. Formatting in UTC keeps a time zone from shifting the day.
const DAYS_AFTER_MONDAY: Record<Weekday, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

const formats = new Map<string, Intl.DateTimeFormat>();

/** The weekday's name in the locale, full ("segunda-feira") or short ("seg."). */
export function weekdayLabel(day: Weekday, locale: Locale, width: "long" | "short" = "long"): string {
  const key = `${locale}/${width}`;
  let format = formats.get(key);
  if (!format) formats.set(key, (format = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" })));
  return format.format(new Date(Date.UTC(2024, 0, 1 + DAYS_AFTER_MONDAY[day])));
}
