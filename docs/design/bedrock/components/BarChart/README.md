# BarChart

A daily or monthly series with average and target: spending per day, spending per month, net worth per month.

- **When to use**: a series over time compared with an average and a target. **When not**: a share of a whole (use `DonutChart`) or the month against its pace (use `PaceChart`).
- **Look**: bars in `chart-bar`, radius `radius-sm`; the bar under the pointer turns `text`. Moving average in `warning` (2px). Target or limit as a dashed `ref` line. Horizontal grid `chart-grid`, 3 lines at most. Axis labels in `text-muted` 11px, abbreviated values ("R$ 8k").
- **Period**: the app puts a `SegmentedControl` above (7D · 30D · 90D · 1Y). Changing the period redraws in `duration-slow`, without motion under `prefers-reduced-motion`.
- **States**: not focusable. Hovering or dragging a bar shows the dark tooltip with date, amount and the why ("Fri, 15 Nov · R$ 412 · Rent"). Loading, empty and error follow Data states in the README: a `Skeleton` in this shape, an `EmptyState`, or a `Banner` inside.
- **Content**: the legend below says Daily, 7-day average, Limit, with a swatch for each (a bar, a solid line, a dashed line). The label is the conclusion, not a description of the drawing.
- **Accessibility**: the chart is a `role="img"` whose `aria-label` is the conclusion. A table with the same values sits beside it, visible only to screen readers, and is the keyboard and screen-reader path. The chart's own focus layer is off. Money is formatted as in `Amount`.

The consumer provides the data (with the moving average), the target, the label, the legend strings and the table. Implementation: `ChartContainer` + Recharts `ComposedChart` (Bar + Line + ReferenceLine), with a restyled `ChartTooltipContent`.
