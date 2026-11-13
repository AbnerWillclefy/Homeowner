import type { AxiosInstance } from "axios";
import { apiClient } from "../../api/client";

export type Range = "30d" | "90d" | "1y";

/** Today's Net worth and its parts, as the API gives them: `totalCents = balancesCents + investmentsCents - cardBillsCents`. */
export interface NetWorthToday {
  totalCents: number;
  balancesCents: number;
  investmentsCents: number;
  cardBillsCents: number;
}

/** `day` is `YYYY-MM-DD`; `cents` is balances plus Investments only. */
export interface NetWorthPoint {
  day: string;
  cents: number;
}

/** `GET /me/finance/net-worth`: `today` is null and `series` empty until a Source balance is stored. */
export interface NetWorth {
  hasData: boolean;
  today: NetWorthToday | null;
  series: NetWorthPoint[];
  /** Past days' card bills are not kept, so the series is never the Net worth. */
  seriesExcludesCardBills: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown): v is number => typeof v === "number";

/** Reads what this screen uses and ignores the rest; null for a body that does not fit. */
export function parseNetWorth(body: unknown): NetWorth | null {
  if (!isRecord(body) || typeof body.hasData !== "boolean" || typeof body.seriesExcludesCardBills !== "boolean" || !Array.isArray(body.series)) return null;
  const { today } = body;
  if (body.hasData ? !isRecord(today) || !num(today.totalCents) || !num(today.balancesCents) || !num(today.investmentsCents) || !num(today.cardBillsCents) : today !== null) return null;
  if (!body.series.every((p) => isRecord(p) && typeof p.day === "string" && num(p.cents))) return null;
  const t = today as unknown as NetWorthToday | null;
  return {
    hasData: body.hasData,
    today: t && { totalCents: t.totalCents, balancesCents: t.balancesCents, investmentsCents: t.investmentsCents, cardBillsCents: t.cardBillsCents },
    series: (body.series as NetWorthPoint[]).map(({ day, cents }) => ({ day, cents })),
    seriesExcludesCardBills: body.seriesExcludesCardBills,
  };
}

/** `GET /me/finance/net-worth?range=`. Throws on any failure, so a query shows its error state. */
export async function getNetWorth(range: Range, client: AxiosInstance = apiClient): Promise<NetWorth> {
  const response = await client.get("/me/finance/net-worth", { params: { range } });
  if (response.status !== 200) throw new Error(`GET /me/finance/net-worth answered ${response.status}`);
  const netWorth = parseNetWorth(response.data);
  if (!netWorth) throw new Error("GET /me/finance/net-worth answered a malformed body");
  return netWorth;
}
