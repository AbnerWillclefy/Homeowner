import type { Source } from "../api";

/** What a Source shows about its balance: nothing for a card, "no balance yet" (never zero) when a bank account has none, else the amount and its day. */
export type BalanceLine = { kind: "none" } | { kind: "unknown" } | { kind: "known"; cents: number; day: string };

/** `YYYY-MM-DD` as the locale writes a day. The day is a calendar date, so it is read in UTC and never shifted by the device's zone. */
export function formatBalanceDay(isoDay: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${isoDay}T00:00:00Z`));
}

export function balanceLine(source: Source, locale: string): BalanceLine {
  if (source.kind === "credit_card") return { kind: "none" };
  if (source.balanceCents === undefined || source.balanceOn === undefined) return { kind: "unknown" };
  return { kind: "known", cents: source.balanceCents, day: formatBalanceDay(source.balanceOn, locale) };
}
