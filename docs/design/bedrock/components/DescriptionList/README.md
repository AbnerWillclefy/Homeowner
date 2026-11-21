# DescriptionList

Label and value pairs, one per line, for summaries and sums that explain themselves ("how the number is made").

- **When to use**: the breakdown of a number (income minus spending, a month's sum), properties of an item (Saved in, Reached in). **When not**: a list of records with an icon (use `ListRow`) or columns to compare (use `Table`).
- **Anatomy**: label in `body` / `text-muted` at the start, value in `body` / `text` at the end, tabular. **One text size** on every line: never a 20px value beside a 14px one in the same list.
- **Total**: the last line may be a total, in `body-strong`, with a `border` divider above it. A subtraction starts its label with "−" ("− Card bills").
- **Phone**: the label truncates; the value never truncates or wraps to the next line. A badge goes after the value on the same line, or moves to the detail.
- **Accessibility**: a `<dl>` with `<dt>` and `<dd>`. Money goes through `Amount`, so it follows hide values.

The consumer provides the lines (label, value, and whether it is the total). Implementation: a `<dl>` on a two-column grid of the tokens.
