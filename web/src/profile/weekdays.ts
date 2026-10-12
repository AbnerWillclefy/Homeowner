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

const formats = new Map<Locale, Intl.DateTimeFormat>();

/** The weekday's full name in the locale, for example "segunda-feira". */
export function weekdayLabel(day: Weekday, locale: Locale): string {
  let format = formats.get(locale);
  if (!format) formats.set(locale, (format = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" })));
  return format.format(new Date(Date.UTC(2024, 0, 1 + DAYS_AFTER_MONDAY[day])));
}
