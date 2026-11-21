# ListRow

A row for a transaction, account, card bill or goal: what it is on the left, how much on the right.

- **When to use**: a list of records with an amount. **When not**: a table of columns to compare (use `Table`), or a single subject's main number (use `StatCard`).
- **Anatomy**: start: `CategoryTag` icon (32px) or the bank's logo (initials only when Pluggy has no logo). Middle: title in `body-strong` and a `caption` line with context ("Nubank · 24/11"). End: `Amount` `sm` and, below it, a Badge or date.
- **Variants**: static, or interactive when the whole row opens the detail (sheet on phones, panel on desktop). An interactive row is at least 48px tall.
- **States**: an interactive row has hover and pressed in `surface-hover` and the `focus` ring. For the list, loading shows 3 skeleton rows of the same height; empty and error follow Data states in the README.
- **Content**: one caption line with at most two facts. Title and caption truncate with an ellipsis and never wrap; the amount never truncates. What does not fit the caption goes to the detail.
- **Row action**: at most one, the one the list exists for ("Mark as paid"). On desktop, a `Button` `sm` after the end. On a phone, a 48px IconButton at the end, the verb in its accessible name; never a text button wrapping to a second line. Other actions sit in the row's `Menu` or in the detail. A row with an action is a plain element: its title is the link to the detail and the action is a sibling button, never a button inside a link. A `border` divider between rows, drawn by the list; group by day under an `overline` header, not a band of background.
- **Accessibility**: an interactive row is a native link or button, operable by keyboard, and everything inside it is inline content. A static row is a plain element. The rows sit in a list. Money goes through `Amount`, including its hidden label in private mode.

The consumer provides the leading element, title, subtitle, cents, `income`, the end element and, for an interactive row, the link or button. Implementation: a plain element on the tokens, with `Amount`. The row action is the optional `action` prop, `{ label, icon, onClick, loading?, disabled?, variant? }`: one Button drawn per width with CSS only, `label` is the verb and its accessible name.
