import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";

export const RANGES = ["7d", "30d"] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = "7d";

/** The days a range covers: how many rows the table has. */
export function rangeDays(range: Range): number {
  return range === "30d" ? 30 : 7;
}

/** `7d` and `30d` are the only ranges; anything else, missing included, is not one. */
export function parseRange(value: string | null): Range | null {
  return RANGES.find((range) => range === value) ?? null;
}

function withRange(params: URLSearchParams, range: Range): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set("range", range);
  return next;
}

/**
 * The range in the URL (`?range=`), so a reload, a shared link and the environment switch all keep it. Anything
 * else falls back to 7d, and the address bar is rewritten (replace, so Back does not return to the bad value).
 * `setRange` keeps the other query parameters.
 */
export function useRange(): [Range, (range: Range) => void] {
  const [params, setParams] = useSearchParams();
  const parsed = parseRange(params.get("range"));

  useEffect(() => {
    if (parsed === null) setParams((current) => withRange(current, DEFAULT_RANGE), { replace: true });
  }, [parsed, setParams]);

  const setRange = useCallback((next: Range) => setParams((current) => withRange(current, next)), [setParams]);
  return [parsed ?? DEFAULT_RANGE, setRange];
}

/** A bar's width as a percentage of the column's largest value; no bar when the largest is 0. */
export function barPercent(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(100, (value / max) * 100);
}
