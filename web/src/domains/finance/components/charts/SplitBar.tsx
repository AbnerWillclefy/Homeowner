import { barPercent } from "../../logic/chart";
import { HATCH } from "./Bar";
import { Marker } from "./Marker";

/**
 * A bar in two parts on one scale: `solid` first, `hatched` after it. Decorative (aria-hidden): the caller says both
 * amounts in text. Lines, not colour, tell the parts apart. Give every bar of a chart the same `max`.
 */
export function SplitBar({ solid, hatched, max, markers = [] }: { solid: number; hatched: number; max: number; markers?: number[] }) {
  const solidWidth = barPercent(solid, max);
  const hatchedWidth = Math.min(barPercent(hatched, max), 100 - solidWidth);
  return (
    <div aria-hidden="true" className="relative flex h-3 rounded-pill border border-border bg-chart-track">
      {solidWidth > 0 && <div data-fill className="rounded-s-pill border border-chart-ink bg-chart-ink" style={{ width: `${solidWidth}%` }} />}
      {hatchedWidth > 0 && (
        <div data-fill className="rounded-e-pill border border-chart-muted" style={{ width: `${hatchedWidth}%`, backgroundImage: HATCH }} />
      )}
      {markers.map((marker) => (
        <Marker key={marker} value={marker} max={max} />
      ))}
    </div>
  );
}
