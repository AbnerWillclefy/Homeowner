# PaceChart

The month's cumulative spending against the ideal pace up to the limit: the hero card's chart.

- A dashed `ref` line from zero (day 1) to the limit (last day). A solid line of cumulative spending up to today, with a 12% area and the end point marked.
- A marker beside the point: a `solid` Badge with the distance from pace ("R$ 200 under"); over pace, the marker turns `warning`.
- No axes on the hero card; on the Categories screen it gets day and amount axes.
- On `hero`: the `--hero` variant (line `hero-line`, reference `on-hero-muted`).

Implementation: shadcn/ui `ChartContainer` (Recharts) with `LineChart`, reading colours from the tokens.
