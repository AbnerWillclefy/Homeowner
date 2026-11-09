import { barPercent } from "../../logic/chart";

/**
 * A reference tick on a Bar's scale: last month's same-days value, or with `limit` the Spending limit. Decorative:
 * the caller says its value in text. The caller's `max` must include the value (`scaleMax`), or the tick pins to
 * the end of the track. The two differ in shape, not colour: last month is a thin tick, the limit a thick, taller
 * one with a square cap.
 */
export function Marker({ value, max, limit = false }: { value: number; max: number; limit?: boolean }) {
  return (
    <span
      aria-hidden="true"
      {...(limit ? { "data-limit-marker": true } : { "data-marker": true })}
      className={`absolute w-0 -translate-x-1/2 border-chart-ink ${limit ? "-inset-y-2 border-s-4" : "-inset-y-1 border-s-2"}`}
      style={{ left: `${barPercent(value, max)}%` }}
    >
      {limit && <span className="absolute -top-px -start-1.5 size-3 bg-chart-ink" />}
    </span>
  );
}
