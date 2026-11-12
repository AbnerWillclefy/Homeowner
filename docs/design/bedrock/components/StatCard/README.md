# StatCard

A subject's main number, with reference, delta and a mini chart.

- **When to use**: one number a screen is about. **When not**: a list of records (use `ListRow`) or a series (use a chart).
- **Variants**: `lg`, and `hero` on the hero `Card`. Value in `value-lg` (or `value-hero` on the hero card); the reference beside it in `text-muted` ("/ R$ 4.983").
- **Anatomy**: the delta in a Badge with icon and sign ("+3%", "R$ 200 under"): colour and shape together, never colour alone. Up to 3 small metrics below, each with a legend colour stroke (Income, Spending, Invested). An optional mini chart (sparkline) to the right or below, without axes. The metrics and the sparkline come after the first release.
- **States**: loading, empty and error follow Data states in the README: a `Skeleton` in this shape, an `EmptyState`, or a `Banner` inside. It is as interactive as the `Card` it is built on.
- **Content**: money goes through `Amount`, never formatted here. The delta says the sign or the direction in words.
- **Accessibility**: the label is text. In private mode the value is hidden from screen readers too, with the consumer's label. If the card is a link, it holds no other link or button.

The consumer provides the label, the value, the reference, the delta element, the hint, the private-mode label, the metrics and the sparkline series. Implementation: `Card` and `Amount`.
