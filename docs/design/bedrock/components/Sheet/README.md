# Sheet

Detail or action without leaving the screen: a bottom sheet on phones, a right side panel on desktop. One component that changes shape at `bp-tablet`.

- Phone: slides up from the bottom, with a handle, `radius-xl` on top, drag to close. Desktop: enters from the right, `panel-width` (440px).
- Header: `section-title` title, a subtitle with count and total, a close button.
- The primary action is pinned to the footer, full width.
- Closes with `Esc`, the `scrim` and the X. Focus returns to what opened it.
- Enters in `duration-slow` / `ease-standard`; leaves in `ease-exit`.

Implementation: `Drawer` (vaul) on phones and `Sheet` (side="right") on desktop, from shadcn/ui, behind a single `ResponsiveSheet` component.
