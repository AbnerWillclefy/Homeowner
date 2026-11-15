import type { NetWorthPoint, NetWorthToday } from "../api";

/** The width, in percent, of Investments, Accounts and card bills in the parts bar: each one's size over the sum of the three sizes. */
export function partWidths({ investmentsCents, balancesCents, cardBillsCents }: NetWorthToday): [number, number, number] {
  const sizes = [investmentsCents, balancesCents, cardBillsCents].map(Math.abs);
  const sum = sizes[0]! + sizes[1]! + sizes[2]!;
  const w = (n: number) => (sum === 0 ? 0 : Math.round((n / sum) * 1000) / 10);
  return [w(sizes[0]!), w(sizes[1]!), w(sizes[2]!)];
}

/** Last point minus first, and its percent of the first (one decimal; null when the first is not above zero). Balances plus Investments only, never the Net worth's change. */
export function seriesChange(series: NetWorthPoint[]): { cents: number; percent: number | null } | null {
  if (series.length < 2) return null;
  const first = series[0]!.cents;
  const cents = series.at(-1)!.cents - first;
  return { cents, percent: first > 0 ? Math.round((cents / first) * 1000) / 10 : null };
}
