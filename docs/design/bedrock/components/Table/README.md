# Table

Rows and columns to compare on desktop: transactions, a budget by category, an account statement.

- **When to use**: three or more columns the person compares or sorts. **When not**: on phones (below `bp-tablet` use a list of `ListRow`s), or for a single column (use `ListRow`).
- **Header**: `label` in `text-muted`, aligned like its column. A sortable column has a button with an arrow; the sorted column is in `text` and carries `aria-sort`.
- **Rows**: 48px, `body`, a `border` divider, hover in `surface-hover`. A row that opens a detail is clickable as a whole and opens the `Sheet`.
- **Numbers**: right-aligned, tabular, in the same column as their header. A cell's content comes from the app (a money app renders `Amount` in it), so Table stays in Core.
- **States**: loading shows skeleton rows of the same height; empty and error follow Data states in the README, inside the table area.
- **Accessibility**: a real `<table>` with `<th scope="col">`, and a caption (visible or `sr-only`) that says what it lists. Never a grid of `div`s.

The consumer provides the columns (header, alignment, sortable), the rows and the sort state. Implementation: shadcn/ui `Table` (plain HTML, no Radix).
