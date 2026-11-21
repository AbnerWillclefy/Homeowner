# DonutChart

Spending distribution by category.

- **When to use**: the share of each category in a total. **When not**: a series over time (use `BarChart`) or progress toward a target (use `ProgressBar`).
- **Look**: a 16px ring, each slice in its `cat-<category>` colour, a 2px gap between slices. Total in the centre. At most 7 slices: the top 6 and the rest as "Other". Slices with no spending are dropped.
- **Legend**: always beside it (desktop) or below (phone), with `CategoryTag` and percentage, in slice order: colour is never the only cue.
- **States**: hovering a slice highlights its legend row and vice versa, with the others dimmed. This is for the mouse; legend rows are not focusable. Loading, empty and error follow Data states in the README: a `Skeleton` in this shape, an `EmptyState`, or a `Banner` inside. With nothing spent, the ring shows only its track and there is no legend.
- **Content**: the label is the conclusion ("Housing takes 41% of spending"). Rounded percentages may not add up to 100%.
- **Accessibility**: the chart is a `role="img"` whose `aria-label` is the conclusion. A table with the same values sits beside it, visible only to screen readers, and is the keyboard and screen-reader path. Money is formatted as in `Amount`.

The consumer provides the slices (category, name, cents), the "Other" name, the label and the table. Implementation: `ChartContainer` + Recharts `PieChart`.
