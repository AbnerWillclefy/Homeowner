# Sheet

Detail or action without leaving the screen: a bottom sheet on phones, a right side panel on desktop. One component that changes shape at `bp-tablet`.

- **When to use**: the detail of a row, a list of items with an action. **When not**: confirming something destructive (use `Dialog`), or a result (use `Toast`).
- **Variants**: phone: slides up from the bottom, with a handle, `radius-xl` on top, drag to close. Desktop: enters from the right, `panel-width` (440px).
- **Anatomy**: header with a `section-title` title, a subtitle with count and total, a close button. The primary action is pinned to the footer, full width.
- **States**: enters in `duration-slow` / `ease-standard`; leaves in `ease-exit`; no motion with `prefers-reduced-motion`. Closes with `Esc`, the `scrim` and the X. Crossing `bp-tablet` while open keeps it open, but focus restarts.
- **Content**: the title says what the sheet shows; the footer action is a verb ("Mark as paid").
- **Accessibility**: announced as a dialog with its title, and its subtitle as description. Focus is trapped while open and returns to what opened it. The close button has a label from the consumer.

The consumer provides `open`, the title, the optional subtitle, the close label, the body and the footer. Implementation: `Drawer` (vaul) on phones and a Radix `Dialog` side panel on desktop, behind a single `Sheet` component.
