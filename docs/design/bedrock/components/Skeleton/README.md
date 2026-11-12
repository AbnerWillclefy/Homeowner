# Skeleton

The shape of content while it loads, at the size of what will arrive.

- **When to use**: the first load of a card, row, list or chart, when the wait passes 300ms. **When not**: when data is already on screen (keep it and show that it is updating), or for an action in progress (use a Button's loading state).
- **Variants**: any size; the consumer sets it to match the final content.
- **States**: not interactive. It is the loading state of the Data states in the README. A soft pulse; still with `prefers-reduced-motion`.
- **Content**: none. Before 300ms, show nothing (no flicker). Once shown, it stays at least 500ms, so it does not flash. Both timings belong to the app, not to the component.
- **Accessibility**: hidden from assistive technology. The region that loads is marked `aria-busy` by the app.

The consumer provides the size and the timing. Reserve the final height: nothing jumps when the data arrives. Implementation: shadcn/ui `Skeleton`, a plain element.
