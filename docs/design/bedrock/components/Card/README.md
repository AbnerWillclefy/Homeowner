# Card

A container for one subject, with a label on top and an arrow that opens that subject's screen.

- **When to use**: to group the content of one subject. **When not**: inside another card, or for a message (use `Banner` or `AlertCard`).
- **Variants**:
  - **default**: padding `space-24` on desktop. **compact** (`br-card--compact`): `space-16` on phones. Radius `radius-lg`. Inner gap `space-16`.
  - **hero**: the only saturated card on the screen, in `hero`. One per screen, for the number the screen exists to show. Text inside it recolours to `on-hero` and `on-hero-muted` with no prop.
- **Parts**: label, content and footer. The label is in `card-label` / `text-muted`, never a large title.
- **States**: loading, empty and error follow Data states in the README: a `Skeleton` in this shape, an `EmptyState`, or a `Banner` inside. When the card leads to a screen, the whole card is clickable (`interactive`): hover and pressed in `surface-hover`, the `focus` ring, and the ↗ arrow in the corner as the visual cue.
- **Content**: do not nest cards. Inside a card, separate with `border` dividers or with space.
- **Accessibility**: an interactive card is one link or button, so it holds no buttons or links inside. The arrow is `aria-hidden`. The label is a plain element, not a heading.

The consumer provides the label, the content and, for an interactive card, the link or button element. Implementation: shadcn/ui `Card` with the variants above.
