/**
 * The Allocator job runs every 15 minutes, so the API accepts only :00, :15, :30 and :45.
 * These are the choices, as "HH:MM" in 24 hours: the same shape the API sends and takes.
 */
export const ALLOCATION_TIMES: readonly string[] = Array.from({ length: 96 }, (_, i) => {
  const hours = String(Math.floor(i / 4)).padStart(2, "0");
  const minutes = String((i % 4) * 15).padStart(2, "0");
  return `${hours}:${minutes}`;
});

/** What a new Home starts with: early enough to plan the day, before most people are out. */
export const DEFAULT_ALLOCATION_TIME = "07:00";

/** "HH:MM" as the locale writes a time of day, for example "7:30 AM" in en-US and "07:30" in pt-BR. */
export function formatAllocationTime(time: string, locale: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const at = Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2]));
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(at);
}

/** The picker's options: every slot, labelled for the locale. A time outside the list (the API refuses one) is shown as it is. */
export function allocationTimeOptions(locale: string, value: string): { value: string; label: string }[] {
  const slots = ALLOCATION_TIMES.includes(value) ? ALLOCATION_TIMES : [value, ...ALLOCATION_TIMES];
  return slots.map((time) => ({ value: time, label: formatAllocationTime(time, locale) }));
}
