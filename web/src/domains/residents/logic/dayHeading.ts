export type DayHeading = { kind: "today" } | { kind: "yesterday" } | { kind: "weekday"; day: string };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** A "YYYY-MM-DD" calendar date as UTC midnight, so the device zone can never shift it. NaN for anything else. */
function utcMidnight(day: string): number {
  const match = DAY.exec(day);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * What a day's group is called, against the Home's own date. Both arguments are "YYYY-MM-DD": `today` is the
 * `date` the API answered (today in the Home's zone), never the device clock. The window is 7 days, so a weekday
 * name never repeats within it.
 */
export function dayHeading(day: string, today: string): DayHeading {
  const apart = Math.round((utcMidnight(today) - utcMidnight(day)) / MS_PER_DAY);
  if (apart === 0) return { kind: "today" };
  if (apart === 1) return { kind: "yesterday" };
  return { kind: "weekday", day };
}

/** The heading's words. The weekday comes from `Intl` in the locale, not from the catalogs. */
export function dayHeadingText(
  heading: DayHeading,
  locale: string,
  words: { today: string; yesterday: string },
): string {
  if (heading.kind === "today") return words.today;
  if (heading.kind === "yesterday") return words.yesterday;
  const at = utcMidnight(heading.day);
  if (Number.isNaN(at)) return heading.day;
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(at);
}
