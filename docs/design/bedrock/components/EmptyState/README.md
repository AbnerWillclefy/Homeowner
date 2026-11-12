# EmptyState

What shows when there is no data yet: it says what will appear there and how to make it happen.

- **When to use**: a list, card or screen with nothing to show. **When not**: an error (use `Banner`) or a wait (use `Skeleton`).
- **Variants**, three kinds:
  - **First use**: what will appear here and the action that starts it ("No goals yet" · "Create goal"), as a primary Button.
  - **No results**: what was searched, and "Clear filters" as a secondary Button. Never the first-use action.
  - **Done**: a success, not an absence ("All bills paid this month"), with a `positive` icon and no action.
- **Anatomy**: an icon in a `brand-soft` circle (`positive-soft` for Done), a short title, one sentence, and the action when there is one. Without an action, no empty gap is left.
- **States**: not interactive itself; its action is a `Button`.
- **Content**: never "No data". Say what is missing: "No goals yet".
- **Accessibility**: the icon is `aria-hidden`. The title is a paragraph and not a heading, so it fits the page outline wherever it is placed.

The consumer provides the kind, the icon, the title, the message and the optional action. Implementation: a plain element on the tokens, with `Button`.
