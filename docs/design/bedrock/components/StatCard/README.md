# StatCard

A subject's main number, with reference, delta and a mini chart.

- Value in `value-lg` (or `value-hero` on the hero card); the reference beside it in `text-muted` ("/ R$ 4.983").
- The delta in a Badge with icon and sign ("+3%", "R$ 200 under"): colour and shape together, never colour alone.
- Up to 3 small metrics below, each with a legend colour stroke (Income, Spending, Invested).
- An optional mini chart (sparkline) to the right or below, without axes.
- States: loading, empty and error follow Data states in the README: a `Skeleton` in this shape, an `EmptyState`, or a `Banner` inside.

The consumer provides the value, the reference, the delta, the metrics and the sparkline series.
