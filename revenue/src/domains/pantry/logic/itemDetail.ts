import type { ItemDetail, ItemPrice } from "../api";

export interface PricePoint {
  day: string;
  cents: number;
  store: string;
}

/** The chart's points, oldest first: the API sends the newest purchase first. */
export const chartPoints = (prices: ItemPrice[]): PricePoint[] =>
  prices.map((p) => ({ day: p.issuedOn, cents: p.unitPriceCents, store: p.storeName })).sort((a, b) => a.day.localeCompare(b.day));

/** The cheapest purchase; on a tie the latest, which is what is true today. */
export const lowestPoint = (points: PricePoint[]): PricePoint | undefined =>
  points.reduce<PricePoint | undefined>((best, p) => (!best || p.cents <= best.cents ? p : best), undefined);

/** `empty`: never bought. `ready`: at least one purchase; `avgDays` is null until a cycle is complete, and the sheet explains that instead of showing a zero. */
export type DetailView = { kind: "empty" } | { kind: "ready"; points: PricePoint[]; last: PricePoint; lowest: PricePoint; avgDays: number | null };

export function detailView(detail: ItemDetail): DetailView {
  const points = chartPoints(detail.prices);
  const last = points.at(-1);
  const lowest = lowestPoint(points);
  if (!last || !lowest) return { kind: "empty" };
  return { kind: "ready", points, last, lowest, avgDays: detail.avgDurationDays };
}

/** The catalog key for "N days" and its count: singular for exactly one. */
export const daysCopy = (days: number) => ({ key: days === 1 ? ("pantry.item.days.one" as const) : ("pantry.item.days.many" as const), count: days });
