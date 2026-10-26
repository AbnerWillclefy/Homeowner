import { describeDelta, type DeltaKind, type DeltaResult } from "./delta";

/**
 * The change against the previous range, in neutral text: a direction is not good or bad (a cost going up is not
 * green), the StatusBadge carries that. Renders nothing for `none`.
 */
export function Delta({ kind, result, days }: { kind: DeltaKind; result: DeltaResult; days: number }) {
  const { arrow, text, speech } = describeDelta(kind, result, days);
  if (text === "") return null;
  return (
    <span className="text-sm text-muted">
      <span aria-hidden="true">
        {arrow && `${arrow} `}
        {text} vs previous {days} days
      </span>
      <span className="sr-only">{speech}</span>
    </span>
  );
}
