# Avatar

A user's photo, or their initials in a circle. **Core** layer.

- Sizes: 72px at the top of a person's page, 40px in rows, 32px inside dense cards.
- No photo: two initials in `brand` on `brand-soft`. No name: the `user` icon in `text-muted`.
- The photo fills the circle (`object-fit: cover`).
- Accessibility: decorative when the name sits beside it; otherwise `alt` with the name.

The consumer provides the photo, the name and the size.
