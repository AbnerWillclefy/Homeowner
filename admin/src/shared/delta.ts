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

export function rateDelta(current: Ratio, previous: Ratio | undefined): DeltaResult {
  if (previous === undefined || current.whole <= 0 || previous.whole <= 0) return { type: "none" };
  const points = Math.round((current.part / current.whole - previous.part / previous.whole) * 100);
  return points === 0 ? { type: "same" } : { type: "points", change: points };
}

export function changeDelta(kind: "count" | "money", current: number, previous: number | undefined): DeltaResult {
  if (previous === undefined) return { type: "none" };
  if (current === previous) return { type: "same" };
  if (previous === 0) return { type: "new" };
  const base = kind === "money" ? MIN_MONEY_BASE_MICROS : MIN_PERCENT_BASE;
  if (previous < base) return { type: "absolute", change: current - previous };
  const percent = Math.round(((current - previous) / previous) * 100);
  return percent === 0 ? { type: "same" } : { type: "percent", change: percent };
}

const sign = (n: number) => (n < 0 ? "-" : "+");

function partialLabel(kind: DeltaKind): string {
  return kind === "count" ? " (count; today is partial)" : kind === "money" ? " (today is partial)" : "";
}

export interface DeltaDescription {
  /** "↑" or "↓" for a change with a direction, otherwise empty. */
  arrow: string;
  /** The visible text; empty when there is nothing to show. */
  text: string;
  /** The same change in words for a screen reader. */
  speech: string;
}

/** The change as an arrow, visible text and screen-reader speech, from one switch over the result. */
export function describeDelta(kind: DeltaKind, result: DeltaResult, days: number): DeltaDescription {
  const against = `against the previous ${days} days`;
  const label = partialLabel(kind);
  const way = (n: number) => (n < 0 ? "down" : "up");
  const arrow = (n: number) => (n < 0 ? "↓" : "↑");
  switch (result.type) {
    case "none":
      return { arrow: "", text: "", speech: "" };
    case "same":
      return { arrow: "", text: "no change", speech: `no change ${against}` };
    case "new":
      return { arrow: "", text: `new${label}`, speech: `new, none in the previous ${days} days${label}` };
    case "points":
      return {
        arrow: arrow(result.change),
        text: `${sign(result.change)}${Math.abs(result.change)} pp`,
        speech: `${way(result.change)} ${Math.abs(result.change)} percentage points ${against}`,
      };
    case "percent":
      return {
        arrow: arrow(result.change),
        text: `${sign(result.change)}${Math.abs(result.change)}%${label}`,
        speech: `${way(result.change)} ${Math.abs(result.change)} percent ${against}${label}`,
      };
    case "absolute": {
      const size = kind === "money" ? formatMicros(Math.abs(result.change)) : String(Math.abs(result.change));
      return {
        arrow: arrow(result.change),
        text: `${sign(result.change)}${size}${label}`,
        speech: `${way(result.change)} ${size} ${against}${label}`,
      };
    }
  }
}
