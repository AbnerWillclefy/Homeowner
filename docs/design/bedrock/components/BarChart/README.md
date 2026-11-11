# BarChart

A daily or monthly series with average and target: spending per day, spending per month, net worth per month.

- Bars in `surface-hover`, radius `radius-sm`; the bar under the pointer turns `text`. Moving average in `warning` (2px). Target or limit as a dashed `ref` line.
- Period picker above (SegmentedControl 7D · 30D · 90D · 1Y); changing the period redraws in `duration-slow`.
- Dragging or hovering shows the dark tooltip with date, amount and the why ("Fri, 15 Nov · R$ 412 · Rent").
- Horizontal grid `chart-grid`, 3 lines at most. Axis labels in `text-muted` 11px, abbreviated values ("R$ 8k").
- Legend below: Daily, 7-day average, Limit.

Implementation: shadcn/ui `ChartContainer` + `ComposedChart` (Bar + Line + ReferenceLine), with a restyled `ChartTooltip`.
