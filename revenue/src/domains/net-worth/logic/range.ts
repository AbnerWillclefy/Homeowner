import type { NetWorthPoint, Range } from "../api";

export const RANGES: Range[] = ["30d", "90d", "1y"];
const DAYS: Record<Range, number> = { "30d": 30, "90d": 90, "1y": 365 };

export const rangeFromParam = (value: string | null): Range => RANGES.find((r) => r === value) ?? "30d";

/** The API draws nothing before the first stored balance, so a short series means the history starts inside the range. */
export const startsLate = (series: NetWorthPoint[], range: Range): boolean => series.length < DAYS[range];
