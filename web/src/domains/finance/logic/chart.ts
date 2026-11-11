/** Arithmetic for the hand-drawn Finances charts. Pure: the components only place what these return. */

/** A value as a share of the maximum, 0 to 100. A refund-heavy (negative) value or a zero maximum gives 0. */
export function barPercent(value: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

/** The shared scale: the largest value or marker, so a marker never falls off its track. Never below 0. */
export function scaleMax(values: number[], markers: number[]): number {
  return Math.max(0, ...values, ...markers);
}

const round = (n: number) => Math.round(n * 100) / 100;

/** SVG `points` for a series on a width x height viewBox, the maximum at the top. One day is a flat line across. */
export function linePoints(points: number[], max: number, width: number, height: number, days = points.length): string {
  const ys = points.map((value) => round(height - (barPercent(value, max) / 100) * height));
  if (!ys.length) return "";
  if (days <= 1 || ys.length === 1) return `0,${ys[0]} ${days <= 1 ? width : round(width / (days - 1))},${ys[0]}`;
  return ys.map((y, i) => `${round((i / (days - 1)) * width)},${y}`).join(" ");
}

export interface DonutPart {
  /** Position in the values given, so the caller can match a part to its category. */
  index: number;
  /** Degrees clockwise from the top. */
  start: number;
  end: number;
  /** Whole percent; the parts add up to 100. */
  percent: number;
}

/** One part per value above zero, in order, covering the full circle. Shares are rounded once here (largest remainder). */
export function donutParts(values: number[]): DonutPart[] {
  const kept = values.flatMap((value, index) => (value > 0 ? [{ value, index }] : []));
  const total = kept.reduce((sum, k) => sum + k.value, 0);
  if (total <= 0) return [];
  const exact = kept.map((k) => (k.value / total) * 100);
  const percents = exact.map(Math.floor);
  const byRemainder = exact.map((e, i) => [e - percents[i]!, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let left = 100 - percents.reduce((a, b) => a + b, 0), i = 0; left > 0; left--, i++) percents[byRemainder[i]![1]]!++;
  let start = 0;
  return kept.map((k, i) => {
    const end = i === kept.length - 1 ? 360 : start + (k.value / total) * 360;
    const part = { index: k.index, start, end, percent: percents[i]! };
    start = end;
    return part;
  });
}

/** The SVG path of a ring segment between two radii, angles in degrees clockwise from the top. 360 degrees is the whole ring. */
export function arcPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const at = (r: number, deg: number) => `${round(cx + r * Math.sin((deg * Math.PI) / 180))} ${round(cy - r * Math.cos((deg * Math.PI) / 180))}`;
  if (end - start >= 359.99) {
    return `M${cx} ${cy - outer}A${outer} ${outer} 0 1 1 ${cx} ${cy + outer}A${outer} ${outer} 0 1 1 ${cx} ${cy - outer}ZM${cx} ${cy - inner}A${inner} ${inner} 0 1 0 ${cx} ${cy + inner}A${inner} ${inner} 0 1 0 ${cx} ${cy - inner}Z`;
  }
  const large = end - start > 180 ? 1 : 0;
  return `M${at(outer, start)}A${outer} ${outer} 0 ${large} 1 ${at(outer, end)}L${at(inner, end)}A${inner} ${inner} 0 ${large} 0 ${at(inner, start)}Z`;
}
