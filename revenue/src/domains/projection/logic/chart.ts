/** One month's bar: `up` or `down` is the height as a percent of its half of the plot, null on the side the month is not on. */
export interface Bar { up: number | null; down: number | null }
export interface ChartLayout {
  bars: Bar[];
  /** CSS `grid-template-rows`: the part above the baseline and the part below it share the plot by their largest values. */
  rows: string;
  /** Every month is zero: the plot keeps its baseline and each bar is the 2px sliver. */
  empty: boolean;
}

/**
 * Bars for the Leftover of each month: a positive one grows up from the baseline, a negative one down. The plot is
 * split at the baseline in proportion to the largest positive and the largest negative value, so one scale serves both.
 */
export function chartLayout(values: number[]): ChartLayout {
  const top = Math.max(0, ...values);
  const bottom = -Math.min(0, ...values);
  const empty = top === 0 && bottom === 0;
  return {
    bars: values.map((v) => ({ up: v >= 0 ? (top ? (v / top) * 100 : 0) : null, down: v < 0 ? (-v / bottom) * 100 : null })),
    rows: empty ? "1fr 0fr" : `${top}fr ${bottom}fr`,
    empty,
  };
}

/** "jan." / "Jan" for the axis. */
export const shortMonth = (month: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
