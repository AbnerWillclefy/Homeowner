# Tooltip

A short label for a control whose meaning is not written next to it: an icon-only button, or a collapsed sidebar item.

- **When to use**: to name an icon-only control. **When not**: for information the person needs to do the task (write it on the screen), on touch-only screens (there is no hover), or on a disabled control (it cannot receive focus).
- **Look**: inverted, `text` on `bg`, `label` 12/16, `radius-md`, padding `space-4` `space-8`, at most 240px wide. One line, no links or buttons inside.
- **Behaviour**: appears on hover after a short delay and immediately on keyboard focus. Disappears on `Esc`, on blur and when the pointer leaves. It sits on `z-tooltip`.
- **Accessibility**: the trigger keeps its own accessible name (`aria-label`). The tooltip repeats it visually; it is never the only name.

The consumer provides the text and the trigger. Implementation: shadcn/ui `Tooltip` (Radix).
