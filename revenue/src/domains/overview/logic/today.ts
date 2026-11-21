/** The calendar day in São Paulo (`YYYY-MM-DD`), the day the API counts "today" in; never the device's own day. */
export function saoPauloDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
