import { formatCapitalisedMonth } from "./month";

/** The last sync as the locale writes a date and time; the zone defaults to the device's. */
export function formatSyncTime(iso: string, locale: string, timeZone?: string): string {
  return formatCapitalisedMonth(new Date(iso), locale, { dateStyle: "medium", timeStyle: "short", timeZone });
}
