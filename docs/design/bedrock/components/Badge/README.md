# Badge

Short state: status, delta or count. Always with a word or icon, never colour alone.

- **When to use**: a status on a row, a delta on a card, a count. **When not**: an action (use `Button`), a category (use `CategoryTag`), or a message (use `Banner`).
- **Variants**: `positive`: Paid, under pace, +3%. `warning`: Due in 2 days, over pace. `danger`: Late, over limit. `neutral`: Scheduled, Edited. `brand`: New, Selected. `solid` only for the value marker on a chart ("R$ 200 under").
- **Size**: a 24px pill, `label`. An optional 12px icon before the text.
- **States**: not interactive.
- **Content**: one or two words, or a sign and a number. Say the state, not the colour.
- **Accessibility**: a `<span>` with text, so the meaning is in the words. The icon is `aria-hidden`.

The consumer provides the tone, the text and the optional icon. Implementation: shadcn/ui `Badge` with these variants.
