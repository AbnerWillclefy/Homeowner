# Skeleton

The shape of content while it loads, at the size of what will arrive.

- Use it when the wait passes 300ms. Before that, show nothing (no flicker).
- Reserve the final height: nothing jumps when the data arrives.
- A soft pulse; still with `prefers-reduced-motion`.

Implementation: shadcn/ui `Skeleton`.
