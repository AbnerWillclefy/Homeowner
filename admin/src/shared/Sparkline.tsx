export type Point = [x: number, y: number];

/**
 * The points of each unbroken run of a series, scaled into a `width` by `height` box (y grows downwards, so the
 * baseline is `height`). A `null` breaks the line. The scale is `max(values, 1)`, so an all-zero series sits flat on
 * the baseline instead of dividing by zero.
 */
export function sparklinePaths(values: (number | null)[], width: number, height: number): Point[][] {
  const top = Math.max(1, ...values.map((v) => v ?? 0));
  const segments: Point[][] = [];
  let current: Point[] | null = null;
  values.forEach((value, i) => {
    if (value === null) {
      current = null;
      return;
    }
    const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
    const point: Point = [x, height - (value / top) * height];
    if (current === null) {
      current = [];
      segments.push(current);
    }
    current.push(point);
  });
  return segments;
}

const WIDTH = 100;
const HEIGHT = 24;

/** A small trend line in inline SVG, no chart library. `label` is its text alternative. */
export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const segments = sparklinePaths(values, WIDTH, HEIGHT);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-8 w-full max-w-48 overflow-visible text-accent"
    >
      <line x1="0" y1={HEIGHT} x2={WIDTH} y2={HEIGHT} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {segments.map((segment, i) =>
        segment.length === 1 ? (
          <polyline
            key={i}
            points={`${segment[0]![0]},${segment[0]![1]} ${segment[0]![0]},${segment[0]![1]}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <polyline
            key={i}
            points={segment.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ),
      )}
    </svg>
  );
}
