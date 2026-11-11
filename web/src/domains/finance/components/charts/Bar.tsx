import type { ReactNode } from "react";
import { useI18n } from "../../../../shared/i18n";
import { barPercent } from "../../logic/chart";
import { formatCents } from "../../logic/money";
import { Marker } from "./Marker";

// Lines, not colour, tell the second series apart. A gradient needs no SVG <pattern> id, so two charts never clash.
export const HATCH = "repeating-linear-gradient(135deg, var(--color-chart-muted) 0 2px, transparent 2px 7px)";

/**
 * A horizontal bar: label, then the amount as text, then the track. The drawing is decorative (aria-hidden) because
 * the amount is always text. Pass the same `max` to every bar of a chart, from `scaleMax`.
 */
export function Bar({
  label,
  value,
  max,
  variant = "solid",
  markers = [],
  limit,
  note,
}: {
  label: ReactNode;
  value: number;
  max: number;
  variant?: "solid" | "hatched";
  markers?: number[];
  /** The Spending limit, drawn as a second kind of tick. `max` must include it. */
  limit?: number | undefined;
  /** A line of text under the bar, such as the marker's value ("Outubro até dia 8: R$ 410,00"). */
  note?: ReactNode;
}) {
  const { locale } = useI18n();
  return (
    <div className="flex flex-col gap-1">
      <span className="[overflow-wrap:anywhere]">{label}</span>
      <span className="text-lg font-bold">{formatCents(value, locale)}</span>
      <Track value={value} max={max} variant={variant} markers={markers} limit={limit} />
      {note && <span className="text-sm text-muted [overflow-wrap:anywhere]">{note}</span>}
    </div>
  );
}

/** The drawn part of a Bar alone, for a row that writes its label and amount its own way. Decorative. */
export function Track({
  value,
  max,
  variant = "solid",
  markers = [],
  limit,
}: {
  value: number;
  max: number;
  variant?: "solid" | "hatched";
  markers?: number[];
  limit?: number | undefined;
}) {
  const percent = barPercent(value, max);
  const hatched = variant === "hatched";
  return (
    <div aria-hidden="true" className="relative h-3 rounded-pill border border-border bg-chart-track">
      {percent > 0 && (
        // The 1px border keeps the fill visible in forced-colors mode, where gradients disappear.
        <div
          data-fill
          className={`absolute inset-y-0 start-0 rounded-pill border ${hatched ? "border-chart-muted" : "border-chart-ink bg-chart-ink"}`}
          style={{ width: `${percent}%`, ...(hatched && { backgroundImage: HATCH }) }}
        />
      )}
      {markers.map((marker) => (
        <Marker key={marker} value={marker} max={max} />
      ))}
      {limit !== undefined && <Marker limit value={limit} max={max} />}
    </div>
  );
}
