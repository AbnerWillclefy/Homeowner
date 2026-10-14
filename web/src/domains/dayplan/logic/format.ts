/** "YYYY-MM-DD" as the locale writes a day, for example "Oct 12". It is a calendar date, so no zone shifts it. */
export function formatDay(day: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const at = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(at);
}

/**
 * An instant (RFC 3339) as a clock time in the locale, for example "2:30 PM". The device's own zone unless
 * one is given. Text that is not a time comes back as it was.
 */
export function formatTime(iso: string, locale: string, timeZone?: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone }).format(at);
}

/** Where a Task's last day falls against the plan's day. Both are "YYYY-MM-DD", so they compare as text. */
export function dueWhen(windowEnd: string, today: string): "past" | "today" | "later" {
  if (windowEnd === today) return "today";
  return windowEnd < today ? "past" : "later";
}
