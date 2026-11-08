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
export function linePoints(points: number[], max: number, width: number, height: number): string {
  const ys = points.map((value) => round(height - (barPercent(value, max) / 100) * height));
  if (ys.length === 1) return `0,${ys[0]} ${width},${ys[0]}`;
  return ys.map((y, i) => `${round((i / (ys.length - 1)) * width)},${y}`).join(" ");
}
