import { deltaSpeech, formatDelta, type DeltaKind, type DeltaResult } from "./delta";

/**
 * The change against the previous range, in neutral text: a direction is not good or bad (a cost going up is not
 * green), the StatusBadge carries that. Renders nothing for `none`.
 */
export function Delta({ kind, result, days }: { kind: DeltaKind; result: DeltaResult; days: number }) {
  const text = formatDelta(kind, result);
  if (text === "") return null;
  const arrow = result.type === "points" || result.type === "percent" || result.type === "absolute" ? (result.change < 0 ? "↓" : "↑") : "";
  return (
    <span className="text-sm text-muted">
      <span aria-hidden="true">
        {arrow && `${arrow} `}
        {text} vs previous {days} days
      </span>
      <span className="sr-only">{deltaSpeech(kind, result, days)}</span>
    </span>
  );
}
