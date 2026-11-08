import { barPercent } from "../../logic/chart";

/**
 * A reference tick (last month's same-days value) on a Bar's scale. Decorative: the caller says its value in text.
 * The caller's `max` must include the marker's value (`scaleMax`), or the tick pins to the end of the track.
 */
export function Marker({ value, max }: { value: number; max: number }) {
  return (
    <span
      aria-hidden="true"
      data-marker
      className="absolute -inset-y-1 w-0 -translate-x-1/2 border-s-2 border-chart-ink"
      style={{ left: `${barPercent(value, max)}%` }}
    />
  );
}
