# ListRow

A row for a transaction, account, card bill or goal: what it is on the left, how much on the right.

- Start: CategoryTag (32px) or the bank's logo. Middle: title in `body-strong` and a `caption` line with context ("Nubank · 24/11"). End: Amount `sm` and, below it, a Badge or date.
- Long text truncates with an ellipsis; the amount never truncates.
- The whole row opens the detail (sheet on phones, panel on desktop). Hover in `surface-hover`.
- A `border` divider between rows; group by day under an `overline` header.
- States, for the list: loading shows 3 skeleton rows of the same height; empty and error follow Data states in the README.
