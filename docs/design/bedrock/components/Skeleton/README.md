# Skeleton

The shape of content while it loads, at the size of what will arrive.

- Use it when the wait passes 300ms. Before that, show nothing (no flicker).
- Reserve the final height: nothing jumps when the data arrives.
- Once shown, it stays at least 500ms, so it does not flash.
- Only for the first load. When data is already on screen, keep it and show that it is updating.
- A soft pulse; still with `prefers-reduced-motion`.

Implementation: shadcn/ui `Skeleton`.
