/** Micro-USD (millionths of a dollar) as dollars: four decimals below one cent, two from one cent up. */
export function formatMicros(micros: number): string {
  const dollars = micros / 1_000_000;
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  return `$${dollars.toFixed(2)}`;
}

/** A token count with thousands separators. */
export function formatTokens(tokens: number): string {
  return new Intl.NumberFormat("en-US").format(tokens);
}

/** Milliseconds, `s` from 1000 ms up; `null` (no calls) is `n/a`. */
export function formatLatency(ms: number | null): string {
  if (ms === null) return "n/a";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms)} ms`;
}

/** Part of a whole as a whole percentage; a zero whole is `n/a`, never `NaN%`. */
export function formatPercent(part: number, whole: number): string {
  if (whole <= 0) return "n/a";
  return `${Math.round((part / whole) * 100)}%`;
}
