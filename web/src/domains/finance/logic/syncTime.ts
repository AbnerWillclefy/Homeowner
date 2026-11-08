/** The last sync as the locale writes a date and time; the zone defaults to the device's. */
export function formatSyncTime(iso: string, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));
}
