# PaceChart

The month's cumulative spending against the ideal pace up to the limit: the hero card's chart.

- **When to use**: spending this month against its limit. **When not**: a series by day or month (use `BarChart`) or a share by category (use `DonutChart`).
- **Look**: a dashed `ref` line from zero (day 1) to the limit (last day). A solid line of cumulative spending up to today, with a 12% area and the end point marked as a hollow circle.
- **Marker**: beside the point, in the look of a `solid` Badge, with the distance from pace ("R$ 200 under"); over pace, the marker turns `warning`. The words ("under", "over") carry the meaning, not the colour.
- **Variants**: no axes on the hero card; on the Categories screen it gets day and amount axes. On `hero`: the `--hero` variant (line `hero-line`, reference `on-hero-muted`).
- **States**: not focusable. Loading, empty and error follow Data states in the README: a `Skeleton` in this shape, an `EmptyState`, or a `Banner` inside. Animation is off under `prefers-reduced-motion`.
- **Content**: the label is the conclusion ("R$ 200 under pace"), not a description of the drawing. Money is formatted as in `Amount`.
- **Accessibility**: the chart is a `role="img"` whose `aria-label` is the conclusion. A table with the day and the amount sits beside it, visible only to screen readers, and is the keyboard and screen-reader path.

The consumer provides the days in the month, the limit, the cumulative spending, the label, the marker text and the table. Implementation: `ChartContainer` + Recharts `ComposedChart` (Area + Line + ReferenceLine + ReferenceDot), reading colours from the tokens.
