# ProgressBar

How much of a target is reached: a goal, a category limit, a reserve.

- **When to use**: progress toward a known target. **When not**: a share of a whole (use `DonutChart`) or an unknown wait (use `Skeleton`).
- **Look**: 8px tall, full radius. Track `surface-sunken`, fill `brand`. Near the limit (≥ 85%, up to and including 100%) it turns `warning`; past it, `danger`, and the text says by how much. With `tone="brand"`, for progress toward a goal where nearly full is good news, the fill stays `brand` at any ratio, and the text alone says when the target is passed.
- **Meta row**: the current amount in `text` on the left, the target and due date in `text-muted` on the right.
- **States**: not interactive. Loading, empty and error belong to the component that holds it.
- **Content**: money wording never presses: "R$ 200 over" says what is, not what to do.
- **Accessibility**: a progress bar that exposes its value, minimum and maximum, with a name. Its spoken value is text the app writes ("R$ 1.640 of R$ 2.000"). Past the target the bar is full while the text states the overage, and colour is never the only cue.

The consumer provides the value, the maximum (above 0), the name, the spoken value and the two meta elements, normally `Amount`. Implementation: shadcn/ui `Progress` (Radix).
