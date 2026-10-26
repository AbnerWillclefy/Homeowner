import { formatMicros } from "./format";

// The change against the previous range. Rates are the headline; counts and money carry a "today is partial" label
// because the current range includes a day that is not over. Never an infinite or NaN percentage.

export type DeltaKind = "rate" | "count" | "money";

/** A rate as its parts, so a zero denominator is visible instead of becoming NaN. */
export interface Ratio {
  part: number;
  whole: number;
}

export type DeltaResult =
  | { type: "none" }
  | { type: "new" }
  | { type: "same" }
  | { type: "absolute"; change: number }
  | { type: "percent"; change: number }
  | { type: "points"; change: number };

/** A count whose previous value is below this shows the absolute change: 1 to 3 is not "+200%". */
export const MIN_PERCENT_BASE = 10;
/** The same for money, in micro-USD ($0.01). */
export const MIN_MONEY_BASE_MICROS = 10_000;

export function delta(kind: "rate", current: Ratio, previous: Ratio | undefined): DeltaResult;
export function delta(kind: "count" | "money", current: number, previous: number | undefined): DeltaResult;
export function delta(kind: DeltaKind, current: Ratio | number, previous: Ratio | number | undefined): DeltaResult {
  if (previous === undefined) return { type: "none" };
  if (kind === "rate") {
    const cur = current as Ratio;
    const prev = previous as Ratio;
    if (cur.whole <= 0 || prev.whole <= 0) return { type: "none" };
    const points = Math.round((cur.part / cur.whole - prev.part / prev.whole) * 100);
    return points === 0 ? { type: "same" } : { type: "points", change: points };
  }
  const cur = current as number;
  const prev = previous as number;
  if (cur === prev) return { type: "same" };
  if (prev === 0) return { type: "new" };
  const base = kind === "money" ? MIN_MONEY_BASE_MICROS : MIN_PERCENT_BASE;
  if (prev < base) return { type: "absolute", change: cur - prev };
  const percent = Math.round(((cur - prev) / prev) * 100);
  return percent === 0 ? { type: "same" } : { type: "percent", change: percent };
}

const sign = (n: number) => (n < 0 ? "-" : "+");

function partialLabel(kind: DeltaKind): string {
  return kind === "count" ? " (count; today is partial)" : kind === "money" ? " (today is partial)" : "";
}

/** The visible text; empty when there is nothing to show. */
export function formatDelta(kind: DeltaKind, result: DeltaResult): string {
  const label = partialLabel(kind);
  switch (result.type) {
    case "none":
      return "";
    case "same":
      return "no change";
    case "new":
      return `new${label}`;
    case "points":
      return `${sign(result.change)}${Math.abs(result.change)} pp`;
    case "percent":
      return `${sign(result.change)}${Math.abs(result.change)}%${label}`;
    case "absolute": {
      const size = kind === "money" ? formatMicros(Math.abs(result.change)) : String(Math.abs(result.change));
      return `${sign(result.change)}${size}${label}`;
    }
  }
}

/** The same change in words for a screen reader. */
export function deltaSpeech(kind: DeltaKind, result: DeltaResult, days: number): string {
  const against = `against the previous ${days} days`;
  const label = partialLabel(kind);
  const way = (n: number) => (n < 0 ? "down" : "up");
  switch (result.type) {
    case "none":
      return "";
    case "same":
      return `no change ${against}`;
    case "new":
      return `new, none in the previous ${days} days${label}`;
    case "points":
      return `${way(result.change)} ${Math.abs(result.change)} percentage points ${against}`;
    case "percent":
      return `${way(result.change)} ${Math.abs(result.change)} percent ${against}${label}`;
    case "absolute": {
      const size = kind === "money" ? formatMicros(Math.abs(result.change)) : String(Math.abs(result.change));
      return `${way(result.change)} ${size} ${against}${label}`;
    }
  }
}
