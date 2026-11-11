# Card

A container for one subject, with a label on top and an arrow that opens that subject's screen.

- Padding `space-24` on desktop and `space-16` on phones (`br-card--compact`). Radius `radius-lg`. Inner gap `space-16`.
- The card's label in `card-label` / `text-muted`, never a large title.
- The whole card is clickable (`interactive`) when it leads to a screen; the ↗ arrow in the corner is the visual cue.
- **hero**: the only saturated card on the screen, in `hero`. One per screen, for the number the screen exists to show.
- Do not nest cards. Inside a card, separate with `border` dividers or with space.

Implementation: shadcn/ui `Card` with the variants above.
