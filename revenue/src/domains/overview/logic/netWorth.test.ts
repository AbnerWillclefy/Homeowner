import { describe, expect, it } from "vitest";
import type { NetWorth } from "../../net-worth/api";
import { netWorthChange } from "./netWorth";

const nw = (over: Partial<NetWorth>): NetWorth => ({ hasData: true, today: null, series: [], seriesExcludesCardBills: true, ...over });

describe("netWorthChange", () => {
  it("is the API's change and its percent of the balances plus Investments at the month's start, never of today's total", () => {
    const data = nw({
      today: { totalCents: 1850000, balancesCents: 650000, investmentsCents: 1350000, cardBillsCents: 150000 },
      monthStart: { day: "2026-10-31", balancesCents: 600000, investmentsCents: 1250000 },
      monthChange: { balancesCents: 50000, investmentsCents: 100000, totalCents: 150000 },
    });
    expect(netWorthChange(data)).toEqual({ cents: 150000, percent: 8.1 });
  });

  it("keeps the amount and drops the percent when the start is zero or negative", () => {
    const data = nw({ monthStart: { day: "2026-10-31", balancesCents: 0, investmentsCents: 0 }, monthChange: { balancesCents: 1, investmentsCents: 0, totalCents: 1 } });
    expect(netWorthChange(data)).toEqual({ cents: 1, percent: null });
  });

  it("is null without the change", () => {
    expect(netWorthChange(nw({}))).toBeNull();
  });
});
