# ChoreTag

A chore Category: an icon in a square of the category's colour, and its name. **Home** layer.

- **When to use**: everywhere a Chore or a Task shows: `TaskCard`, Chores rows, filter chips, the catalog. **When not**: a spending category (use `CategoryTag`, Finance).
- Icon colour `chore-<category>` on `chore-<category>-soft`. The same on every screen.
- Sizes: 40px in `TaskCard`, 32px in rows, 24px in chips and captions.
- **The name always shows as text** beside it or in the row's caption. Colour is never the only cue.
- Fixed icons (Lucide): Kitchen `cooking-pot`, Bathroom `bath`, Bedroom `bed-double`, Living room `sofa`, Laundry `shirt`, Floors `brush`, Trash `trash-2`, Outdoor `trees`, Pets `paw-print`, Other `shapes`.
- An unknown or empty category becomes Other, never the raw id.
- Accessibility: the icon is decorative (`aria-hidden`); the name is what a screen reader reads.

The consumer provides the category id. Implementation: a `<span>` on the tokens; the id → icon map lives in the component.
