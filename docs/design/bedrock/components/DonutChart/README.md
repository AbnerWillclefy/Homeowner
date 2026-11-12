# DonutChart

Spending distribution by category.

- A 16px ring, each slice in its `cat-<category>` colour, a 2px gap between slices. Total in the centre.
- At most 7 slices; the rest becomes "Other".
- The legend always sits beside it (desktop) or below (phone), with CategoryTag and percentage, in slice order: colour is never the only cue.
- Hovering a slice highlights its legend row and vice versa.
- States: loading, empty and error follow Data states in the README: a `Skeleton` in this shape, an `EmptyState`, or a `Banner` inside.

Implementation: shadcn/ui `ChartContainer` + `PieChart` (Recharts).
