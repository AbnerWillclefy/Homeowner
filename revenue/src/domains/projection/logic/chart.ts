export const BAR_WIDTH = 36;
export const STRIDE = 52;
export const PLOT_TOP = 16;
export const PLOT_HEIGHT = 160;

export interface Bar { x: number; y: number; h: number; negative: boolean }
export interface ChartLayout { bars: Bar[]; baseline: number; top: number; bottom: number }

/**
 * Bars for the Leftover of each month: a positive one grows up from the baseline, a negative one down. The plot is a
 * fixed height, shared by the largest positive and the largest negative value. `top` and `bottom` are the values at the
 * plot's edges (`bottom` is 0 when no month is negative). A zero month still gets a 2px sliver so it can be seen.
 */
export function chartLayout(values: number[]): ChartLayout {
  const top = Math.max(0, ...values);
  const bottom = Math.min(0, ...values);
  const scale = top - bottom === 0 ? 0 : PLOT_HEIGHT / (top - bottom);
  const baseline = PLOT_TOP + top * scale;
  const bars = values.map((v, i): Bar => {
    const h = Math.max(2, Math.abs(v) * scale);
    return { x: i * STRIDE + 8, y: v >= 0 ? baseline - h : baseline, h, negative: v < 0 };
  });
  return { bars, baseline, top, bottom };
}

/** "jan." / "Jan" for the axis. */
export const shortMonth = (month: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
