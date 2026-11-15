import type { NetWorth } from "../../net-worth/api";

/**
 * This month's change of balances plus Investments (card bills are not stored for past days, so they are in neither end),
 * and its percent of the month's start, one decimal. The percent is null when the start is not above zero. Never a percent of today's total.
 */
export function netWorthChange(data: NetWorth): { cents: number; percent: number | null } | null {
  const { monthChange, monthStart } = data;
  if (!monthChange) return null;
  const base = monthStart ? monthStart.balancesCents + monthStart.investmentsCents : 0;
  return { cents: monthChange.totalCents, percent: base > 0 ? Math.round((monthChange.totalCents / base) * 1000) / 10 : null };
}
